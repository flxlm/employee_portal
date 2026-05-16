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

/**
 * Pick the active menu key from a schedule given the current local time.
 * Uses the first matching window (ordered by day, then start_time).
 */
export function pickActiveMenuKey(
  entries: ScheduleEntry[],
  now: Date = new Date(),
): string | null {
  const day = now.getDay(); // 0=Sun..6=Sat
  const yesterday = (day + 6) % 7;
  const cur = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  for (const e of entries) {
    const s = toMin(e.start_time);
    const en = toMin(e.end_time);
    // Case 1: all-day window (start == end)
    if (s === en) {
      if (e.day_of_week === day) return e.menu_key;
      continue;
    }
    // Case 2: same-day window (start < end), no wrap
    if (s < en) {
      if (e.day_of_week === day && cur >= s && cur < en) return e.menu_key;
      continue;
    }
    // Case 3: wrap-around window (start > end), spans midnight.
    // day_of_week is the START day:
    //   (a) we are still on the start day, after start time
    //   (b) we are on the day after the start day, before end time
    if (e.day_of_week === day && cur >= s) return e.menu_key;
    if (e.day_of_week === yesterday && cur < en) return e.menu_key;
  }
  return null;
}
