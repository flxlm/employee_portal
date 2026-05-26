import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DeptCost = {
  departmentId: number;
  departmentName: string;
  totalHours: number;
  laborCost: number | null;
};

export type LaborCostResult = {
  weekStart: string;
  weekEnd: string;
  departments: DeptCost[];
  totalHours: number;
  totalLaborCost: number | null;
  wageSource: "user" | "punch" | "none";
};

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function shifts7fetch(path: string, apiKey: string): Promise<any> {
  const res = await fetch(`https://api.7shifts.com/v2${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`7shifts API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function extractWage(obj: any): number | null {
  if (!obj) return null;
  const candidates = [
    obj.wage,
    obj.default_wage,
    obj.hourly_wage,
    obj.hourly_rate,
    obj.base_wage,
    obj.base_hourly_rate,
    obj.pay_rate,
    obj.wage_rate,
    obj.employee_wage,
    obj.compensation?.hourly_rate,
    obj.compensation?.wage,
  ];
  for (const v of candidates) {
    if (typeof v === "number" && v > 0) return v;
    if (typeof v === "string" && parseFloat(v) > 0) return parseFloat(v);
  }
  return null;
}

export const getLaborCost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ weekOffset: z.number().int().optional().default(0) }).parse(input)
  )
  .handler(async ({ data: input, context }): Promise<LaborCostResult> => {
    await ensureAdmin(context.supabase, context.userId);

    const apiKey = process.env.SECRET_7SHIFTS_API_KEY;
    if (!apiKey) throw new Error("7shifts API key is not configured (SECRET_7SHIFTS_API_KEY).");

    const companyId = process.env.SEVEN_SHIFTS_COMPANY_ID;
    if (!companyId) throw new Error("7shifts company ID is not configured (SEVEN_SHIFTS_COMPANY_ID).");

    // Compute ISO week (Mon–Sun)
    const now = new Date();
    const day = now.getUTCDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diffToMon + (input.weekOffset ?? 0) * 7);
    monday.setUTCHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);

    const weekStart = toISODate(monday);
    const weekEnd = toISODate(sunday);

    // 1. Departments
    const deptsRes = await shifts7fetch(`/company/${companyId}/departments`, apiKey);
    const deptMap = new Map<number, string>();
    for (const d of deptsRes.data ?? []) deptMap.set(d.id, d.name);

    // 2. Employees → wage map
    const usersRes = await shifts7fetch(`/company/${companyId}/users?limit=500`, apiKey);
    const wageMap = new Map<number, number | null>();
    for (const u of usersRes.data ?? []) {
      wageMap.set(u.id, extractWage(u));
    }

    // 3. Time punches
    const qs = new URLSearchParams({
      start: monday.toISOString(),
      end: sunday.toISOString(),
      limit: "500",
    });
    const punchRes = await shifts7fetch(`/company/${companyId}/time_punches?${qs}`, apiKey);
    const punches: any[] = punchRes.data ?? [];

    // 4. Aggregate by department
    type Acc = {
      departmentName: string;
      totalHours: number;
      laborCost: number;
      hasAllWages: boolean;
    };
    const accMap = new Map<number, Acc>();
    let anyUserWage = false;
    let anyPunchWage = false;

    for (const punch of punches) {
      const deptId: number = punch.department_id ?? 0;
      const deptName = deptMap.get(deptId) ?? (deptId === 0 ? "Unassigned" : `Department #${deptId}`);

      let hours = 0;
      if (punch.clocked_in && punch.clocked_out) {
        hours = (new Date(punch.clocked_out).getTime() - new Date(punch.clocked_in).getTime()) / (1000 * 60 * 60);
      }
      hours = Math.max(0, hours);

      // Try user-level wage first, then wage embedded in the punch itself
      let wage = wageMap.get(punch.user_id) ?? null;
      if (wage !== null) anyUserWage = true;
      if (wage === null) {
        wage = extractWage(punch);
        if (wage !== null) anyPunchWage = true;
      }

      if (!accMap.has(deptId)) {
        accMap.set(deptId, { departmentName: deptName, totalHours: 0, laborCost: 0, hasAllWages: true });
      }
      const acc = accMap.get(deptId)!;
      acc.totalHours += hours;

      if (wage !== null && acc.hasAllWages) {
        acc.laborCost += hours * wage;
      } else {
        acc.hasAllWages = false;
      }
    }

    const departments: DeptCost[] = Array.from(accMap.entries()).map(([departmentId, acc]) => ({
      departmentId,
      departmentName: acc.departmentName,
      totalHours: acc.totalHours,
      laborCost: acc.hasAllWages ? acc.laborCost : null,
    }));

    departments.sort((a, b) => {
      const order = (n: string) =>
        /foh|front/i.test(n) ? 0 : /boh|back/i.test(n) ? 1 : 2;
      return order(a.departmentName) - order(b.departmentName) ||
        a.departmentName.localeCompare(b.departmentName);
    });

    const totalHours = departments.reduce((s, d) => s + d.totalHours, 0);
    const anyNullCost = departments.some((d) => d.laborCost === null);
    const totalLaborCost = anyNullCost ? null : departments.reduce((s, d) => s + (d.laborCost ?? 0), 0);
    const wageSource: "user" | "punch" | "none" = anyUserWage ? "user" : anyPunchWage ? "punch" : "none";

    return { weekStart, weekEnd, departments, totalHours, totalLaborCost, wageSource };
  });
