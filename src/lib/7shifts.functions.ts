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

// Build a wage map (userId:roleId -> hourly rate) from multiple sources.
// Priority: scheduled shifts > hours_and_wages report > punch.wage_rate
async function buildWageMap(
  companyId: string,
  locationId: string | undefined,
  weekStart: string,
  weekEnd: string,
  monday: Date,
  apiKey: string,
): Promise<Map<string, number>> {
  const wageMap = new Map<string, number>();

  function tryAddWage(userId: any, roleId: any, wage: any) {
    if (!userId || !roleId) return;
    if (typeof wage !== "number" || wage < 3 || wage > 500) return;
    const key = `${userId}:${roleId}`;
    if (!wageMap.has(key)) wageMap.set(key, wage);
  }

  // Source 1: scheduled shifts — most reliable; present even for unapproved punches
  try {
    const qs = new URLSearchParams({ start: weekStart, end: weekEnd, limit: "500" });
    if (locationId) qs.set("location_id", locationId);
    const res = await shifts7fetch(`/company/${companyId}/shifts?${qs}`, apiKey);
    for (const s of res.data ?? []) tryAddWage(s.user_id, s.role_id, s.wage);
  } catch { }

  // Source 2: hours_and_wages report for the past 12 weeks (approved punches)
  try {
    const from = new Date(monday);
    from.setUTCDate(monday.getUTCDate() - 77);
    const qs = new URLSearchParams({
      company_id: companyId,
      from: toISODate(from),
      to: weekEnd,
      punches: "true",
    });
    if (locationId) qs.set("location_id", locationId);
    const res = await shifts7fetch(`/reports/hours_and_wages?${qs}`, apiKey);

    // API may return { data: [...] } or { data: { users: [...] } } or { users: [...] }
    const users: any[] = Array.isArray(res.data)
      ? res.data
      : (res.data?.users ?? res.users ?? []);

    for (const u of users) {
      const userId = u.user_id ?? u.id;
      // Structure A: user -> weeks[] -> shifts[]
      for (const week of u.weeks ?? []) {
        for (const s of week.shifts ?? []) tryAddWage(userId, s.role_id, s.wage);
      }
      // Structure B: user -> shifts[] (flat)
      for (const s of u.shifts ?? []) tryAddWage(userId, s.role_id, s.wage);
    }
  } catch { }

  return wageMap;
}

// POST avoids edge-cache serving the same response for every week
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

    // Roles -> deptId, Departments -> name
    const rolesRes = await shifts7fetch(`/company/${companyId}/roles`, apiKey);
    const roleDeptMap = new Map<number, number>();
    for (const r of rolesRes.data ?? []) {
      if (r.department_id) roleDeptMap.set(r.id, r.department_id);
    }

    const deptsRes = await shifts7fetch(`/company/${companyId}/departments`, apiKey);
    const deptMap = new Map<number, string>();
    for (const d of deptsRes.data ?? []) deptMap.set(d.id, d.name);

    const wageMap = await buildWageMap(companyId, locationId, weekStart, weekEnd, monday, apiKey);

    // All time punches — approved AND unapproved
    const punchQs = new URLSearchParams({
      start: monday.toISOString(),
      end: sunday.toISOString(),
      limit: "500",
    });
    if (locationId) punchQs.set("location_id", locationId);
    const punchRes = await shifts7fetch(`/company/${companyId}/time_punches?${punchQs}`, apiKey);
    const punches: any[] = punchRes.data ?? [];

    type Acc = { departmentName: string; totalHours: number; laborCost: number; hasAllWages: boolean };
    const accMap = new Map<number, Acc>();

    for (const punch of punches) {
      const roleId: number = punch.role_id ?? 0;
      const deptId: number = punch.department_id ?? roleDeptMap.get(roleId) ?? 0;
      const deptName = deptMap.get(deptId) ?? "Unassigned";

      let hours = 0;
      if (punch.clocked_in && punch.clocked_out) {
        hours = Math.max(
          0,
          (new Date(punch.clocked_out).getTime() - new Date(punch.clocked_in).getTime()) / (1000 * 60 * 60),
        );
      }

      // Wage: wageMap first; fall back to punch.wage_rate if it looks hourly
      const wageKey = `${punch.user_id}:${roleId}`;
      const punchRate = typeof punch.wage_rate === "number" && punch.wage_rate >= 3 && punch.wage_rate <= 500
        ? punch.wage_rate : null;
      const wage = wageMap.get(wageKey) ?? punchRate;

      if (!accMap.has(deptId)) {
        accMap.set(deptId, { departmentName: deptName, totalHours: 0, laborCost: 0, hasAllWages: true });
      }
      const acc = accMap.get(deptId)!;
      acc.totalHours += hours;
      if (wage != null && acc.hasAllWages) {
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
