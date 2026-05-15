import { createFileRoute, Link, redirect } from "@tanstack/react-router";
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
} from "@/lib/menu-schedule.functions";
import { listMenus } from "@/lib/menus.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
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

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft className="h-4 w-4" /> Back to Admin
      </Link>
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
            className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!menuKey) {
                toast.error("Pick a menu");
                return;
              }
              addMut.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Menu</Label>
              <Select value={menuKey} onValueChange={setMenuKey}>
                <SelectTrigger><SelectValue placeholder="Select menu" /></SelectTrigger>
                <SelectContent>
                  {menus.map((m) => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Day</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <Button type="submit" disabled={addMut.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>The first matching slot wins. Times are in the restaurant's local time.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No slots yet. The Live Menu will fall back to the first available menu.</p>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center py-3">
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
