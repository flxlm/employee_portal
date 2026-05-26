import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DeptCost = {
  departmentId: number;
  departmentName: string;
  totalHours: number;
  laborCost: number;
};

export type LaborCostResult = {
  weekStart: string;
  weekEnd: string;
  departments: DeptCost[];
  totalHours: number;
  totalLaborCost: number;
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
      "x-api-version": "2022-10-01",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`7shifts API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
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

    // Compute ISO week Monday
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

    // 1. Roles → Map<roleId, departmentId>
    const rolesRes = await shifts7fetch(`/company/${companyId}/roles`, apiKey);
    const roleDeptMap = new Map<number, number>();
    for (const r of rolesRes.data ?? []) {
      if (r.department_id) roleDeptMap.set(r.id, r.department_id);
    }

    // 2. Departments → Map<deptId, name>
    const deptsRes = await shifts7fetch(`/company/${companyId}/departments`, apiKey);
    const deptMap = new Map<number, string>();
    for (const d of deptsRes.data ?? []) deptMap.set(d.id, d.name);

    // 3. Hours & wages report
    // Endpoint: GET /v2/reports/hours_and_wages
    // company_id is a query param, not in the path
    const qs = new URLSearchParams({
      company_id: companyId,
      from: weekStart,
      to: weekEnd,
      punches: "true",
    });
    const locationId = process.env.SEVEN_SHIFTS_LOCATION_ID;
    if (locationId) qs.set("location_id", locationId);
    const reportRes = await shifts7fetch(`/reports/hours_and_wages?${qs}`, apiKey);

    // 4. Aggregate total_hours and total_pay by department
    const accMap = new Map<number, { departmentName: string; totalHours: number; laborCost: number }>();

    for (const userEntry of reportRes.users ?? []) {
      for (const weekEntry of userEntry.weeks ?? []) {
        for (const shift of weekEntry.shifts ?? []) {
          const roleId: number = shift.role_id ?? 0;
          const deptId: number = roleDeptMap.get(roleId) ?? 0;
          const deptName = deptMap.get(deptId) ?? "Unassigned";
          const hours: number = shift.total?.total_hours ?? 0;
          const pay: number = shift.total?.total_pay ?? 0;

          if (!accMap.has(deptId)) {
            accMap.set(deptId, { departmentName: deptName, totalHours: 0, laborCost: 0 });
          }
          const acc = accMap.get(deptId)!;
          acc.totalHours += hours;
          acc.laborCost += pay;
        }
      }
    }

    const departments: DeptCost[] = Array.from(accMap.entries()).map(([departmentId, acc]) => ({
      departmentId,
      departmentName: acc.departmentName,
      totalHours: acc.totalHours,
      laborCost: acc.laborCost,
    }));

    departments.sort((a, b) => {
      const order = (n: string) =>
        /foh|front/i.test(n) ? 0 : /boh|back/i.test(n) ? 1 : 2;
      return order(a.departmentName) - order(b.departmentName) ||
        a.departmentName.localeCompare(b.departmentName);
    });

    const totalHours = departments.reduce((s, d) => s + d.totalHours, 0);
    const totalLaborCost = departments.reduce((s, d) => s + d.laborCost, 0);

    return { weekStart, weekEnd, departments, totalHours, totalLaborCost };
  });
