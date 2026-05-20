import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  addScheduleEntry,
  deleteScheduleEntry,
  listMenuSchedule,
  updateScheduleEntry,
  type ScheduleEntry,
  addMenuSpecial,
  deleteMenuSpecial,
  listMenuSpecials,
} from "@/lib/menu-schedule.functions";
import { listMenus } from "@/lib/menus.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/live-menu-timetable")({
  beforeLoad: async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) throw redirect({ to: "/login" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sess.session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/events" });
  },
  component: LiveMenuTimetablePage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime(t: string) {
  return t.slice(0, 5);
}

function LiveMenuTimetablePage() {
  const list = useServerFn(listMenuSchedule);
  const listMenusFn = useServerFn(listMenus);
  const add = useServerFn(addScheduleEntry);
  const update = useServerFn(updateScheduleEntry);
  const remove = useServerFn(deleteScheduleEntry);
  const qc = useQueryClient();

  const { data: schedRes, isLoading } = useQuery({
    queryKey: ["menu-schedule"],
    queryFn: () => list(),
  });
  const { data: menusRes } = useQuery({
    queryKey: ["menus"],
    queryFn: () => listMenusFn(),
  });
  const entries = schedRes?.entries ?? [];
  const menus = menusRes?.menus ?? [];

  const [menuKey, setMenuKey] = useState<string>("");
  const [day, setDay] = useState<string>("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("12:00");

  const addMut = useMutation({
    mutationFn: () =>
      add({
        data: {
          menu_key: menuKey,
          day_of_week: Number(day),
          start_time: start,
          end_time: end,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-schedule"] });
      toast.success("Time slot added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (e: ScheduleEntry) =>
      update({
        data: {
          id: e.id,
          menu_key: e.menu_key,
          day_of_week: e.day_of_week,
          start_time: e.start_time,
          end_time: e.end_time,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu-schedule"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-schedule"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ============ Specials ============
  const listSpecials = useServerFn(listMenuSpecials);
  const addSpecial = useServerFn(addMenuSpecial);
  const removeSpecial = useServerFn(deleteMenuSpecial);

  const { data: specialsRes } = useQuery({
    queryKey: ["menu-specials"],
    queryFn: () => listSpecials(),
  });
  const specials = specialsRes?.specials ?? [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const [spMenuKey, setSpMenuKey] = useState<string>("");
  const [spDate, setSpDate] = useState(todayStr);
  const [spStart, setSpStart] = useState("12:00");
  const [spEnd, setSpEnd] = useState("14:00");

  const addSpecialMut = useMutation({
    mutationFn: () =>
      addSpecial({
        data: {
          menu_key: spMenuKey,
          slot_date: spDate,
          start_time: spStart,
          end_time: spEnd,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-specials"] });
      toast.success("Special slot added");
      setSpMenuKey("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSpecialMut = useMutation({
    mutationFn: (id: string) => removeSpecial({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu-specials"] });
      toast.success("Removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl mb-2">Live Menu Timetable</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Define which menu is shown on the Live Menu display, by day and time. The Live Menu page automatically switches to the matching menu.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add a time slot</CardTitle>
          <CardDescription>Pick a menu, day and time window.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_auto] md:grid-rows-[auto_auto] gap-x-3 gap-y-1.5 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (!menuKey) {
                toast.error("Pick a menu");
                return;
              }
              addMut.mutate();
            }}
          >
            <Label className="md:row-start-1 md:col-start-1">Menu</Label>
            <Label className="md:row-start-1 md:col-start-2">Day</Label>
            <Label className="md:row-start-1 md:col-start-3">Start</Label>
            <Label className="md:row-start-1 md:col-start-4">End</Label>
            <span className="hidden md:block md:row-start-1 md:col-start-5" aria-hidden />

            <Select value={menuKey} onValueChange={setMenuKey}>
              <SelectTrigger className="md:row-start-2 md:col-start-1"><SelectValue placeholder="Select menu" /></SelectTrigger>
              <SelectContent>
                {menus.map((m) => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="md:row-start-2 md:col-start-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="md:row-start-2 md:col-start-3"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <Input
              className="md:row-start-2 md:col-start-4"
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
            <Button
              type="submit"
              disabled={addMut.isPending}
              className="w-full md:w-auto md:row-start-2 md:col-start-5"
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-6 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Add a Special Time Slot
          </CardTitle>
          <CardDescription>
            One-off slot for a specific date. Overrides the regular schedule and disappears automatically after the day passes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_150px_120px_120px_auto] md:grid-rows-[auto_auto] gap-x-3 gap-y-1.5 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (!spMenuKey) {
                toast.error("Pick a menu");
                return;
              }
              if (spDate < todayStr) {
                toast.error("Date must be today or later");
                return;
              }
              addSpecialMut.mutate();
            }}
          >
            <Label className="md:row-start-1 md:col-start-1">Menu</Label>
            <Label className="md:row-start-1 md:col-start-2">Date</Label>
            <Label className="md:row-start-1 md:col-start-3">Start</Label>
            <Label className="md:row-start-1 md:col-start-4">End</Label>
            <span className="hidden md:block md:row-start-1 md:col-start-5" aria-hidden />

            <Select value={spMenuKey} onValueChange={setSpMenuKey}>
              <SelectTrigger className="md:row-start-2 md:col-start-1"><SelectValue placeholder="Select menu" /></SelectTrigger>
              <SelectContent>
                {menus.map((m) => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="md:row-start-2 md:col-start-2"
              type="date"
              value={spDate}
              min={todayStr}
              onChange={(e) => setSpDate(e.target.value)}
            />
            <Input
              className="md:row-start-2 md:col-start-3"
              type="time"
              value={spStart}
              onChange={(e) => setSpStart(e.target.value)}
            />
            <Input
              className="md:row-start-2 md:col-start-4"
              type="time"
              value={spEnd}
              onChange={(e) => setSpEnd(e.target.value)}
            />
            <Button
              type="submit"
              disabled={addSpecialMut.isPending}
              className="w-full md:w-auto md:row-start-2 md:col-start-5"
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </form>

          {specials.length > 0 && (
            <ul className="mt-4 divide-y divide-border">
              {specials.map((s) => {
                const menuLabel = menus.find((m) => m.key === s.menu_key)?.label ?? s.menu_key;
                const d = new Date(s.slot_date + "T00:00:00");
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-medium">{menuLabel}</span>
                      <span className="text-muted-foreground">
                        {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                        {" · "}
                        {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                      </span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeSpecialMut.mutate(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>Recurring weekly schedule. Special slots above take priority. Times are in the restaurant's local time.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No slots yet. The Live Menu will fall back to the first available menu.</p>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_auto] gap-3 items-center py-3">
                  <Select
                    value={e.menu_key}
                    onValueChange={(v) => updateMut.mutate({ ...e, menu_key: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {menus.map((m) => (
                        <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(e.day_of_week)}
                    onValueChange={(v) => updateMut.mutate({ ...e, day_of_week: Number(v) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    defaultValue={fmtTime(e.start_time)}
                    onBlur={(ev) => {
                      const v = ev.target.value;
                      if (v && v !== fmtTime(e.start_time)) updateMut.mutate({ ...e, start_time: v });
                    }}
                  />
                  <Input
                    type="time"
                    defaultValue={fmtTime(e.end_time)}
                    onBlur={(ev) => {
                      const v = ev.target.value;
                      if (v && v !== fmtTime(e.end_time)) updateMut.mutate({ ...e, end_time: v });
                    }}
                  />
                  <div className="flex justify-end">
                    <Button size="icon" variant="ghost" onClick={() => removeMut.mutate(e.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
