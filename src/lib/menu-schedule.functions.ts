import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ScheduleEntry = {
  id: string;
  menu_key: string;
  day_of_week: number; // 0=Sun..6=Sat
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
};

export const listMenuSchedulePublic = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ entries: ScheduleEntry[] }> => {
    const { data, error } = await supabaseAdmin
      .from("menu_schedule")
      .select("id, menu_key, day_of_week, start_time, end_time")
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return { entries: (data ?? []) as ScheduleEntry[] };
  },
);

export const listMenuSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ entries: ScheduleEntry[] }> => {
    const { data, error } = await context.supabase
      .from("menu_schedule")
      .select("id, menu_key, day_of_week, start_time, end_time")
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return { entries: (data ?? []) as ScheduleEntry[] };
  });

const EntryInput = z.object({
  menu_key: z.string().min(1).max(40),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

export const addScheduleEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EntryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("menu_schedule")
      .insert(data)
      .select("id, menu_key, day_of_week, start_time, end_time")
      .single();
    if (error) throw error;
    return { entry: row as ScheduleEntry };
  });

export const updateScheduleEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    EntryInput.extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("menu_schedule")
      .update(rest)
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteScheduleEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("menu_schedule")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ Special one-off slots ============

export type SpecialEntry = {
  id: string;
  menu_key: string;
  slot_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
  notes: string | null;
};

export const listMenuSpecialsPublic = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ specials: SpecialEntry[] }> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabaseAdmin
      .from("menu_schedule_specials")
      .select("id, menu_key, slot_date, start_time, end_time, notes")
      .gte("slot_date", today)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return { specials: (data ?? []) as SpecialEntry[] };
  },
);

export const listMenuSpecials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ specials: SpecialEntry[] }> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await context.supabase
      .from("menu_schedule_specials")
      .select("id, menu_key, slot_date, start_time, end_time, notes")
      .gte("slot_date", today)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return { specials: (data ?? []) as SpecialEntry[] };
  });

const SpecialInput = z.object({
  menu_key: z.string().min(1).max(40),
  slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  notes: z.string().max(500).optional().nullable(),
});

export const addMenuSpecial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SpecialInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("menu_schedule_specials")
      .insert(data)
      .select("id, menu_key, slot_date, start_time, end_time, notes")
      .single();
    if (error) throw error;
    return { special: row as SpecialEntry };
  });

export const deleteMenuSpecial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("menu_schedule_specials")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Pick the active menu key. Specials take priority over the recurring schedule.
 */
export function pickActiveMenuKey(
  entries: ScheduleEntry[],
  now: Date = new Date(),
  specials: SpecialEntry[] = [],
): string | null {
  const day = now.getDay();
  const yesterday = (day + 6) % 7;
  const cur = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Specials first — exact-date match
  for (const s of specials) {
    if (s.slot_date !== todayStr) continue;
    const st = toMin(s.start_time);
    const en = toMin(s.end_time);
    if (st === en) return s.menu_key;
    if (st < en) {
      if (cur >= st && cur < en) return s.menu_key;
    } else {
      // wrap-around (start > end), spans midnight
      if (cur >= st) return s.menu_key;
    }
  }

  for (const e of entries) {
    const s = toMin(e.start_time);
    const en = toMin(e.end_time);
    if (s === en) {
      if (e.day_of_week === day) return e.menu_key;
      continue;
    }
    if (s < en) {
      if (e.day_of_week === day && cur >= s && cur < en) return e.menu_key;
      continue;
    }
    if (e.day_of_week === day && cur >= s) return e.menu_key;
    if (e.day_of_week === yesterday && cur < en) return e.menu_key;
  }
  return null;
}
