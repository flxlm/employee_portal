import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addAllowedEmail, listAllowedEmails, removeAllowedEmail } from "@/lib/admin.functions";
import { getMenuWebhookUrl, setMenuWebhookUrl } from "@/lib/app-settings.functions";
import { getLaborCost, type LaborCostResult, type DeptCost, type PunchNote } from "@/lib/7shifts.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Trash2, UserPlus, ShieldAlert, Type, Clock, Save, Webhook, Megaphone, DollarSign, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_app/admin")({
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
  component: AdminPage,
});

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const fmt = (s: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(s + "T12:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  const start = fmt(weekStart, { weekday: "short", month: "short", day: "numeric" });
  const end = fmt(weekEnd, { weekday: "short", month: "short", day: "numeric" });
  const year = new Date(weekEnd + "T12:00:00Z").getUTCFullYear();
  return `${start} – ${end}, ${year}`;
}

function fmtHours(h: number): string { return h.toFixed(1) + "h"; }

function fmtCost(c: number | null): string {
  if (c === null) return "—";
  return "$" + c.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function LaborCostSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-44 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    </div>
  );
}

function LaborCostContent({ data }: { data: LaborCostResult }) {
  return (
    <div className="space-y-6">
      <LaborBarChart departments={data.departments} />
      <LaborTable departments={data.departments} totalHours={data.totalHours} totalLaborCost={data.totalLaborCost} />
      {data.punchNotes.length > 0 && <PunchNotes notes={data.punchNotes} />}
    </div>
  );
}

function PunchNotes({ notes }: { notes: PunchNote[] }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Punch Notes</p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {notes.map((n, i) => (
          <li key={i} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{n.departmentName}</span>
              <span>·</span>
              <span>{fmt(n.clockedIn)}</span>
            </span>
            <span>{n.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LaborBarChart({ departments }: { departments: DeptCost[] }) {
  if (departments.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No shifts recorded for this week.</p>;
  }
  const hasCost = departments.some((d) => d.laborCost !== null);
  const chartData = departments.map((d) => ({
    name: d.departmentName,
    value: hasCost
      ? (d.laborCost !== null ? parseFloat(d.laborCost.toFixed(2)) : 0)
      : parseFloat(d.totalHours.toFixed(1)),
  }));
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis
            tickFormatter={(v) => hasCost ? `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v}` : `${v}h`}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number) => [hasCost ? fmtCost(value) : fmtHours(value), hasCost ? "Labor Cost" : "Hours"]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LaborTable({ departments, totalHours, totalLaborCost }: {
  departments: DeptCost[];
  totalHours: number;
  totalLaborCost: number | null;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Department</TableHead>
          <TableHead className="text-right">Hours</TableHead>
          <TableHead className="text-right">Labor Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {departments.map((d) => (
          <TableRow key={d.departmentId}>
            <TableCell className="font-medium">{d.departmentName}</TableCell>
            <TableCell className="text-right tabular-nums">{fmtHours(d.totalHours)}</TableCell>
            <TableCell className="text-right tabular-nums font-medium">{fmtCost(d.laborCost)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold">Total</TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{fmtHours(totalHours)}</TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{fmtCost(totalLaborCost)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function AdminPage() {
  const list = useServerFn(listAllowedEmails);
  const add = useServerFn(addAllowedEmail);
  const remove = useServerFn(removeAllowedEmail);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);

  const fetchLaborCost = useServerFn(getLaborCost);
  const [weekOffset, setWeekOffset] = useState(0);
  const { data: laborData, isLoading: laborLoading, error: laborError } = useQuery({
    queryKey: ["labor-cost", weekOffset],
    queryFn: () => fetchLaborCost({ data: { weekOffset } }),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const fetchWebhookUrl = useServerFn(getMenuWebhookUrl);
  const saveWebhookUrl = useServerFn(setMenuWebhookUrl);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSaving, setWebhookSaving] = useState(false);
  useEffect(() => {
    fetchWebhookUrl().then((r) => setWebhookUrl(r.url)).catch(() => {});
  }, []);

  const { data, isLoading } = useQuery({ queryKey: ["allowed-emails"], queryFn: () => list() });

  const addMut = useMutation({
    mutationFn: (vars: { email: string; as_admin: boolean }) => add({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allowed-emails"] });
      setEmail("");
      setAsAdmin(false);
      toast.success("Email added");
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const rmMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["allowed-emails"] }); toast.success("Removed"); },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl mb-6">Admin</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Menu formatting</CardTitle>
          <CardDescription>Control fonts, sizes and weights for the live menu display.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/menu-formatting"><Type className="h-4 w-4 mr-2" /> Open formatting editor</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Announcement bar</CardTitle>
          <CardDescription>Manage the announcement bar shown on the customer-facing website.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/announcements"><Megaphone className="h-4 w-4 mr-2" /> Open announcement editor</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Live Menu timetable</CardTitle>
          <CardDescription>Schedule which menu shows on the Live Menu display by day and time.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/live-menu-timetable"><Clock className="h-4 w-4 mr-2" /> Open timetable</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle><Webhook className="h-4 w-4 inline mr-2" />Menu change webhook</CardTitle>
          <CardDescription>
            URL that receives a POST <code>{`{ event: "menu_updated", timestamp }`}</code> whenever the menu is republished. Leave blank to disable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="url" placeholder="https://example.com/webhooks/menu" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
            <Button size="sm" disabled={webhookSaving} onClick={async () => {
              setWebhookSaving(true);
              try {
                await saveWebhookUrl({ data: { url: webhookUrl.trim() } });
                toast.success("Webhook URL saved");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to save");
              } finally {
                setWebhookSaving(false);
              }
            }}>
              <Save className="h-4 w-4 mr-2" /> {webhookSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle><DollarSign className="h-4 w-4 inline mr-2" />Labor Cost</CardTitle>
              <CardDescription className="mt-1">
                {laborData ? `Week of ${formatWeekLabel(laborData.weekStart, laborData.weekEnd)}` : "Current week labor cost by department"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" disabled={weekOffset === 0} onClick={() => setWeekOffset(0)} className="text-xs px-2">Today</Button>
              <Button variant="ghost" size="icon" disabled={weekOffset >= 0} onClick={() => setWeekOffset((o) => o + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {laborLoading && <LaborCostSkeleton />}
          {laborError && !laborLoading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Failed to load labor data</AlertTitle>
              <AlertDescription>{(laborError as Error).message}</AlertDescription>
            </Alert>
          )}
          {laborData && !laborLoading && <LaborCostContent data={laborData} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowed emails</CardTitle>
          <CardDescription>Only these emails can sign up for the portal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email) addMut.mutate({ email, as_admin: asAdmin });
            }}
            className="space-y-3"
          >
            <div className="flex gap-2">
              <Input type="email" placeholder="employee@savsav.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" disabled={addMut.isPending}>
                <UserPlus className="h-4 w-4 mr-2" /> Add
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="as-admin" className="text-sm font-normal">Make this user an admin on signup</Label>
              <Switch id="as-admin" checked={asAdmin} onCheckedChange={setAsAdmin} />
            </div>
          </form>
          <div className="border-t border-border">
            {isLoading ? (
              <p className="py-6 text-sm text-muted-foreground">Loading…</p>
            ) : (data ?? []).length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground text-center">No invites yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(data ?? []).map((row: any) => (
                  <li key={row.id} className="flex items-center justify-between py-3">
                    <span className="text-sm flex items-center gap-2">
                      {row.email}
                      {row.as_admin && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <ShieldAlert className="h-3.5 w-3.5" /> admin
                        </span>
                      )}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => rmMut.mutate(row.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
