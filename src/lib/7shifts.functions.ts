import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DeptCost = {
  departmentId: number;
  departmentName: string;
  totalHours: number;
  laborCost: number | null; // null = no wage data at all; partial = some punches had no wage
  partialCost: boolean;
  hasPunchError: boolean;
};

export type PunchNote = {
  userId: number;
  departmentId: number;
  departmentName: string;
  clockedIn: string;
  note: string;
};

export type PunchError = {
  userId: number;
  departmentId: number;
  departmentName: string;
  clockedIn: string | null;
  clockedOut: string | null;
  hours: number;
  reasons: string[];
};

export type LaborCostResult = {
  weekStart: string;
  weekEnd: string;
  departments: DeptCost[];
  totalHours: number;
  totalLaborCost: number | null;
  partialLaborCost: boolean;
  punchNotes: PunchNote[];
  punchErrors: PunchError[];
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

// hourly_wage in the time_punches response is in cents
function centsToHours(cents: number): number {
  return cents / 100;
}

function calcPunchHours(punch: any): number {
  if (!punch.clocked_in) return 0;
  const clockIn = new Date(punch.clocked_in).getTime();
  const clockOut = punch.clocked_out ? new Date(punch.clocked_out).getTime() : Date.now();
  let ms = Math.max(0, clockOut - clockIn);
  for (const brk of punch.breaks ?? []) {
    if (!brk.paid && brk.in) {
      const bIn = new Date(brk.in).getTime();
      const bOut = brk.out ? new Date(brk.out).getTime() : Date.now();
      ms -= Math.max(0, bOut - bIn);
    }
  }
  return Math.max(0, ms / (1000 * 60 * 60));
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

    // Fetch all time punches for the week via cursor pagination
    const allPunches: any[] = [];
    const baseQs = new URLSearchParams({ business_date_start: weekStart, business_date_end: weekEnd, limit: "200" });
    if (locationId) baseQs.set("location_id", locationId);

    let cursor: string | null = null;
    let page = 0;
    do {
      const qs = new URLSearchParams(baseQs);
      if (cursor) qs.set("cursor", cursor);
      const res = await shifts7fetch(`/company/${companyId}/time_punches?${qs}`, apiKey);
      allPunches.push(...(res.data ?? []));
      cursor = res.meta?.cursor?.next ?? null;
      page++;
    } while (cursor && page < 20);

    type Acc = { departmentName: string; totalHours: number; laborCost: number; wageCount: number; noWageCount: number; hasPunchError: boolean };
    const accMap = new Map<number, Acc>();
    function upsert(deptId: number, deptName: string): Acc {
      if (!accMap.has(deptId)) {
        accMap.set(deptId, { departmentName: deptName, totalHours: 0, laborCost: 0, wageCount: 0, noWageCount: 0, hasPunchError: false });
      }
      return accMap.get(deptId)!;
    }

    const punchNotes: PunchNote[] = [];
    const punchErrors: PunchError[] = [];

    for (const punch of allPunches) {
      if (punch.deleted) continue;
      const deptId: number = punch.department_id || roleDeptMap.get(punch.role_id) || 0;
      const deptName = deptMap.get(deptId) ?? "Unassigned";
      const hours = calcPunchHours(punch);
      const hourlyWage = centsToHours(punch.hourly_wage ?? 0);

      const acc = upsert(deptId, deptName);
      acc.totalHours += hours;
      if (hourlyWage > 0) {
        acc.laborCost += hours * hourlyWage;
        acc.wageCount++;
      } else {
        acc.noWageCount++;
      }

      const reasons: string[] = [];
      if (!punch.clocked_in) reasons.push("No clock-in");
      if (!punch.clocked_out) reasons.push("No clock-out");
      if (hourlyWage === 0) reasons.push("No wage on file");
      if (hours > 10) reasons.push("Over 10 hours");

      if (reasons.length > 0) {
        acc.hasPunchError = true;
        punchErrors.push({
          userId: punch.user_id,
          departmentId: deptId,
          departmentName: deptName,
          clockedIn: punch.clocked_in ?? null,
          clockedOut: punch.clocked_out ?? null,
          hours,
          reasons,
        });
      }

      if (punch.notes && typeof punch.notes === "string" && punch.notes.trim()) {
        punchNotes.push({
          userId: punch.user_id,
          departmentId: deptId,
          departmentName: deptName,
          clockedIn: punch.clocked_in,
          note: punch.notes.trim(),
        });
      }
    }

    const departments: DeptCost[] = Array.from(accMap.entries()).map(([departmentId, acc]) => ({
      departmentId,
      departmentName: acc.departmentName,
      totalHours: acc.totalHours,
      laborCost: acc.wageCount > 0 ? acc.laborCost : null,
      partialCost: acc.noWageCount > 0,
      hasPunchError: acc.hasPunchError,
    }));

    departments.sort((a, b) => {
      const rank = (n: string) => (/foh|front/i.test(n) ? 0 : /boh|back/i.test(n) ? 1 : 2);
      return rank(a.departmentName) - rank(b.departmentName) || a.departmentName.localeCompare(b.departmentName);
    });

    const totalHours = departments.reduce((s, d) => s + d.totalHours, 0);
    const anyNullCost = departments.every((d) => d.laborCost === null);
    const totalLaborCost = anyNullCost ? null : departments.reduce((s, d) => s + (d.laborCost ?? 0), 0);
    const partialLaborCost = departments.some((d) => d.partialCost || d.laborCost === null);

    return { weekStart, weekEnd, departments, totalHours, totalLaborCost, partialLaborCost, punchNotes, punchErrors };
  });
