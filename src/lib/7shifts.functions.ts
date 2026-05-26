import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RoleHours = {
  roleId: number;
  roleName: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  estimatedCost: number | null;
};

export type LaborCostResult = {
  weekStart: string;
  weekEnd: string;
  roles: RoleHours[];
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  totalEstimatedCost: number | null;
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

    // Compute ISO week (Mon–Sun) offset by weekOffset weeks
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

    // 1. Get roles → Map<id, name>
    const rolesRes = await shifts7fetch(`/company/${companyId}/roles`, apiKey);
    const roleMap = new Map<number, string>();
    for (const r of rolesRes.data ?? []) {
      roleMap.set(r.id, r.name);
    }

    // 2. Fetch time punches for the week
    const qs = new URLSearchParams({
      start: monday.toISOString(),
      end: sunday.toISOString(),
      limit: "500",
    });
    const punchRes = await shifts7fetch(`/company/${companyId}/time_punches?${qs}`, apiKey);
    const punches: any[] = punchRes.data ?? [];

    // 3. Aggregate by role — compute hours from clocked_in/clocked_out timestamps
    type Acc = {
      roleName: string;
      regularHours: number;
      overtimeHours: number;
      estimatedCost: number | null;
      hasAllWages: boolean;
    };
    const accMap = new Map<number, Acc>();

    for (const punch of punches) {
      const roleId: number = punch.role_id ?? 0;
      const roleName = roleMap.get(roleId) ?? (roleId === 0 ? "Unassigned" : `Unknown Role #${roleId}`);

      // Calculate hours from timestamps; fall back to API fields if present
      let hours = 0;
      if (punch.clocked_in && punch.clocked_out) {
        hours = (new Date(punch.clocked_out).getTime() - new Date(punch.clocked_in).getTime()) / (1000 * 60 * 60);
      } else {
        hours = (punch.regular_hours ?? 0) + (punch.overtime_hours ?? 0);
      }
      hours = Math.max(0, hours);

      const wageRate: number | null = punch.wage_rate ?? null;

      if (!accMap.has(roleId)) {
        accMap.set(roleId, { roleName, regularHours: 0, overtimeHours: 0, estimatedCost: 0, hasAllWages: true });
      }
      const acc = accMap.get(roleId)!;
      acc.regularHours += hours;

      if (wageRate !== null && acc.hasAllWages) {
        (acc.estimatedCost as number) += hours * wageRate;
      } else {
        acc.hasAllWages = false;
        acc.estimatedCost = null;
      }
    }

    const roles: RoleHours[] = Array.from(accMap.entries()).map(([roleId, acc]) => ({
      roleId,
      roleName: acc.roleName,
      regularHours: acc.regularHours,
      overtimeHours: acc.overtimeHours,
      totalHours: acc.regularHours + acc.overtimeHours,
      estimatedCost: acc.hasAllWages ? acc.estimatedCost : null,
    }));

    roles.sort((a, b) => b.totalHours - a.totalHours);

    const totalRegularHours = roles.reduce((s, r) => s + r.regularHours, 0);
    const totalOvertimeHours = roles.reduce((s, r) => s + r.overtimeHours, 0);
    const totalHours = totalRegularHours + totalOvertimeHours;
    const anyNullCost = roles.some((r) => r.estimatedCost === null);
    const totalEstimatedCost = anyNullCost
      ? null
      : roles.reduce((s, r) => s + (r.estimatedCost ?? 0), 0);

    return { weekStart, weekEnd, roles, totalRegularHours, totalOvertimeHours, totalHours, totalEstimatedCost };
  });
