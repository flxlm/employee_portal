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

// Each shift entry has: user_id, role_id, wage, total.total_hours, total.total_pay
function extractReportShifts(response: any): any[] {
  if (!response) return [];
  // { data: { users: [{ shifts: [...] }] } }
  if (Array.isArray(response.data?.users)) {
    return response.data.users.flatMap((u: any) => u.shifts ?? []);
  }
  // { data: { shifts: [...] } }
  if (Array.isArray(response.data?.shifts)) return response.data.shifts;
  // { data: [{ shifts: [...] }] }
  if (Array.isArray(response.data)) {
    const first = response.data[0];
    if (first && Array.isArray(first.shifts)) {
      return response.data.flatMap((u: any) => u.shifts ?? []);
    }
    return response.data;
  }
  // { users: [{ shifts: [...] }] }
  if (Array.isArray(response.users)) {
    return response.users.flatMap((u: any) => u.shifts ?? []);
  }
  // { shifts: [...] }
  if (Array.isArray(response.shifts)) return response.shifts;
  return [];
}

export const getLaborCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ weekOffset: z.coerce.number().int().optional().default(0) }).parse(input)
  )
  .handler(async ({ data: input, context }): Promise<LaborCostResult> => {
    await ensureAdmin(context.supabase, context.userId);

    const apiKey = process.env.SECRET_7SHIFTS_API_KEY;
    if (!apiKey) throw new Error("7shifts API key is not configured (SECRET_7SHIFTS_API_KEY).");

    const companyId = process.env.SEVEN_SHIFTS_COMPANY_ID?.trim();
    if (!companyId) throw new Error("7shifts company ID is not configured (SEVEN_SHIFTS_COMPANY_ID).");

    const locationId = process.env.SEVEN_SHIFTS_LOCATION_ID?.trim() || undefined;

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

    // Roles → Map<roleId, departmentId> and Departments → Map<deptId, name>
    const [rolesRes, deptsRes] = await Promise.all([
      shifts7fetch(`/company/${companyId}/roles`, apiKey),
      shifts7fetch(`/company/${companyId}/departments`, apiKey),
    ]);
    const roleDeptMap = new Map<number, number>();
    for (const r of rolesRes.data ?? []) {
      if (r.department_id) roleDeptMap.set(r.id, r.department_id);
    }
    const deptMap = new Map<number, string>();
    for (const d of deptsRes.data ?? []) deptMap.set(d.id, d.name);

    type Acc = { departmentName: string; totalHours: number; laborCost: number; hasAllWages: boolean };
    const accMap = new Map<number, Acc>();
    function upsert(deptId: number, deptName: string): Acc {
      if (!accMap.has(deptId)) {
        accMap.set(deptId, { departmentName: deptName, totalHours: 0, laborCost: 0, hasAllWages: true });
      }
      return accMap.get(deptId)!;
    }

    // --- Source 1: hours_and_wages report (approved punches) ---
    // Use total_pay and total_hours directly from each shift entry.
    // Also build wageMap for estimating cost of unapproved punches below.
    const wageMap = new Map<string, number>(); // "userId:roleId" → hourly wage
    const reportQs = new URLSearchParams({
      company_id: companyId,
      from: weekStart,
      to: weekEnd,
      punches: "true",
    });
    if (locationId) reportQs.set("location_id", locationId);

    try {
      const reportRes = await shifts7fetch(`/reports/hours_and_wages?${reportQs}`, apiKey);
      const shifts = extractReportShifts(reportRes);

      for (const shift of shifts) {
        const roleId: number = shift.role_id ?? 0;
        const deptId: number = roleDeptMap.get(roleId) ?? 0;
        const deptName = deptMap.get(deptId) ?? "Unassigned";
        const hours: number = shift.total?.total_hours ?? 0;
        const pay: number = shift.total?.total_pay ?? 0;
        const wage = shift.wage;

        if (shift.user_id && roleId && typeof wage === "number" && wage > 0 && wage <= 500) {
          const wk = `${shift.user_id}:${roleId}`;
          if (!wageMap.has(wk)) wageMap.set(wk, wage);
        }

        const acc = upsert(deptId, deptName);
        acc.totalHours += hours;
        acc.laborCost += pay;
      }
    } catch {
      // report unavailable; unapproved punches below will still show hours
    }

    // --- Source 2: unapproved time punches ---
    // Approved punches are already counted above. Only add unapproved ones to avoid double-counting.
    const punchQs = new URLSearchParams({
      start: monday.toISOString(),
      end: sunday.toISOString(),
      limit: "500",
    });
    if (locationId) punchQs.set("location_id", locationId);
    const punchRes = await shifts7fetch(`/company/${companyId}/time_punches?${punchQs}`, apiKey);
    const unapproved: any[] = (punchRes.data ?? []).filter((p: any) => !p.approved);

    for (const punch of unapproved) {
      const roleId: number = punch.role_id ?? 0;
      const deptId: number = punch.department_id ?? roleDeptMap.get(roleId) ?? 0;
      const deptName = deptMap.get(deptId) ?? "Unassigned";

      let hours = 0;
      if (punch.clocked_in) {
        const end = punch.clocked_out ? new Date(punch.clocked_out) : new Date();
        hours = Math.max(0, (end.getTime() - new Date(punch.clocked_in).getTime()) / (1000 * 60 * 60));
      }

      const wage = wageMap.get(`${punch.user_id}:${roleId}`) ?? null;
      const acc = upsert(deptId, deptName);
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
      const rank = (n: string) => (/foh|front/i.test(n) ? 0 : /boh|back/i.test(n) ? 1 : 2);
      return rank(a.departmentName) - rank(b.departmentName) || a.departmentName.localeCompare(b.departmentName);
    });

    const totalHours = departments.reduce((s, d) => s + d.totalHours, 0);
    const anyNullCost = departments.some((d) => d.laborCost === null);
    const totalLaborCost = anyNullCost ? null : departments.reduce((s, d) => s + (d.laborCost ?? 0), 0);

    return { weekStart, weekEnd, departments, totalHours, totalLaborCost };
  });
