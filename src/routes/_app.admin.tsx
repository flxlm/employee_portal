import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addAllowedEmail, listAllowedEmails, removeAllowedEmail } from "@/lib/admin.functions";
import { getMenuWebhookUrl, setMenuWebhookUrl } from "@/lib/app-settings.functions";
import { getLaborCost, type LaborCostResult, type RoleHours } from "@/lib/7shifts.functions";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

// ─── Labor Cost helpers & sub-components ──────────────────────────────────────────────

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const fmt = (s: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(s + "T12:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  const start = fmt(weekStart, { weekday: "short", month: "short", day: "numeric" });
  const end = fmt(weekEnd, { weekday: "short", month: "short", day: "numeric" });
  const year = new Date(weekEnd + "T12:00:00Z").getUTCFullYear();
  return `${start} – ${end}, ${year}`;
}

function fmtHours(h: number): string {
  return h.toFixed(1) + "h";
}

function fmtCost(c: number | null): string {
  if (c === null) return "—";
  return "$" + c.toFixed(2);
}

function LaborCostSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

function LaborCostContent({ data }: { data: LaborCostResult }) {
  return (
    <div className="space-y-6">
      <LaborBarChart roles={data.roles} />
      <LaborTable roles={data.roles} totalEstimatedCost={data.totalEstimatedCost} />
    </div>
  );
}

function LaborBarChart({ roles }: { roles: RoleHours[] }) {
  if (roles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No time punches recorded for this week.
      </p>
    );
  }
  const data = roles.map((r) => ({
    role: r.roleName.length > 14 ? r.roleName.slice(0, 13) + "…" : r.roleName,
    Hours: parseFloat(r.totalHours.toFixed(1)),
  }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis dataKey="role" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `${v}h`} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}h`, "Hours"]}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="Hours" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LaborTable({ roles, totalEstimatedCost }: { roles: RoleHours[]; totalEstimatedCost: number | null }) {
  const showCost = roles.some((r) => r.estimatedCost !== null);
  const totalAll = roles.reduce((s, r) => s + r.totalHours, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Total Hours</TableHead>
          {showCost && <TableHead className="text-right">Est. Cost</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((r) => (
          <TableRow key={r.roleId}>
            <TableCell className="font-medium">{r.roleName}</TableCell>
            <TableCell className="text-right tabular-nums font-medium">{fmtHours(r.totalHours)}</TableCell>
            {showCost && <TableCell className="text-right tabular-nums">{fmtCost(r.estimatedCost)}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold">Total</TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{fmtHours(totalAll)}</TableCell>
          {showCost && <TableCell className="text-right font-semibold tabular-nums">{fmtCost(totalEstimatedCost)}</TableCell>}
        </TableRow>
      </TableFooter>
    </Table>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
    mutationFn: (vars: { email: string; as_admin: boolean }) =>
      add({ data: vars }),
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
            <Link to="/menu-formatting">
              <Type className="h-4 w-4 mr-2" /> Open formatting editor
            </Link>
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
            <Link to="/announcements">
              <Megaphone className="h-4 w-4 mr-2" /> Open announcement editor
            </Link>
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
            <Link to="/live-menu-timetable">
              <Clock className="h-4 w-4 mr-2" /> Open timetable
            </Link>
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
            <Input
              type="url"
              placeholder="https://example.com/webhooks/menu"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <Button
              size="sm"
              disabled={webhookSaving}
              onClick={async () => {
                setWebhookSaving(true);
                try {
                  await saveWebhookUrl({ data: { url: webhookUrl.trim() } });
                  toast.success("Webhook URL saved");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to save");
                } finally {
                  setWebhookSaving(false);
                }
              }}
            >
              <Save className="h-4 w-4 mr-2" /> {webhookSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle><DollarSign className="h-4 w-4 inline mr-2" />Labor Cost</CardTitle>
              <CardDescription className="mt-1">
                {laborData
                  ? `Week of ${formatWeekLabel(laborData.weekStart, laborData.weekEnd)}`
                  : "Current week hours by role"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={weekOffset === 0}
                onClick={() => setWeekOffset(0)}
                className="text-xs px-2"
              >
                Today
              </Button>
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
              <Label htmlFor="as-admin" className="text-sm font-normal">
                Make this user an admin on signup
              </Label>
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
