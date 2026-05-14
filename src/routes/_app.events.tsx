import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getEventInquiries, updateEventInquiry, type EventInquiry } from "@/lib/sheets.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Calendar, Users, Clock, RefreshCw, ExternalLink, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  "",
  "FORM FILLED",
  "ESTIMATE SENT",
  "REMINDER SENT",
  "AWAITING PAYMENT",
  "CONFIRMED",
  "DECLINED",
  "REFUSED, LOW BUDGET",
];

// Sheet date format: DD-MM-YYYY <-> HTML date input YYYY-MM-DD
function sheetDateToInput(s: string): string {
  if (!s) return "";
  const m = s.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const iso = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return "";
}
function inputDateToSheet(s: string): string {
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Sheet time format: "6:00 PM" <-> HTML time input HH:MM (24h)
function sheetTimeToInput(s: string): string {
  if (!s) return "";
  const t = s.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2];
  const ampm = m[3]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}
function inputTimeToSheet(s: string): string {
  if (!s) return "";
  const m = s.match(/^(\d{2}):(\d{2})$/);
  if (!m) return s;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ampm}`;
}

export const Route = createFileRoute("/_app/events")({
  component: EventsPage,
});

const BUCKETS = [
  { id: "NEW", label: "New" },
  { id: "FORM FILLED", label: "Form filled" },
  { id: "ESTIMATE SENT", label: "Estimate sent" },
  { id: "REMINDER SENT", label: "Reminder sent" },
  { id: "AWAITING PAYMENT", label: "Awaiting payment" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "DECLINED", label: "Declined" },
  { id: "REFUSED, LOW BUDGET", label: "Refused, low budget" },
  { id: "PAST", label: "Past" },
] as const;

const EDITABLE_FIELDS: { key: keyof EventInquiry; label: string; type: "input" | "textarea" | "select" | "date" | "time" }[] = [
  { key: "rawStatus", label: "Status", type: "select" },
  { key: "email", label: "Email", type: "input" },
  { key: "eventDate", label: "Event date", type: "date" },
  { key: "guests", label: "Guests", type: "input" },
  { key: "reservationType", label: "Reservation type", type: "input" },
  { key: "startTime", label: "Start time", type: "time" },
  { key: "arrivalTime", label: "Guest arrival", type: "time" },
  { key: "endTime", label: "End time", type: "time" },
  { key: "barService", label: "Bar service", type: "input" },
  { key: "foodService", label: "Food service", type: "input" },
  { key: "dj", label: "DJ", type: "input" },
  { key: "budget", label: "Budget", type: "input" },
  { key: "prepaid", label: "Prepaid bar", type: "input" },
  { key: "description", label: "Notes", type: "textarea" },
];

function statusVariant(b: EventInquiry["bucket"]) {
  switch (b) {
    case "CONFIRMED": return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "DECLINED":
    case "REFUSED, LOW BUDGET": return "bg-rose-100 text-rose-900 border-rose-300";
    case "ESTIMATE SENT":
    case "REMINDER SENT":
    case "AWAITING PAYMENT": return "bg-amber-100 text-amber-900 border-amber-300";
    case "PAST": return "bg-muted text-muted-foreground border-border";
    default: return "bg-sky-100 text-sky-900 border-sky-300";
  }
}

function EventsPage() {
  const fetchFn = useServerFn(getEventInquiries);
  const updateFn = useServerFn(updateEventInquiry);
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["event-inquiries"],
    queryFn: () => fetchFn(),
  });
  const [selected, setSelected] = useState<EventInquiry | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selected) {
      const d: Record<string, string> = {};
      for (const f of EDITABLE_FIELDS) d[f.key as string] = (selected[f.key] as string) ?? "";
      setDraft(d);
      setEditing(false);
    }
  }, [selected]);

  const mutation = useMutation({
    mutationFn: async (vars: { rowNumber: number; updates: Record<string, string> }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Inquiry updated");
      qc.invalidateQueries({ queryKey: ["event-inquiries"] });
      setSelected(null);
    },
    onError: (e: Error) => toast.error(`Update failed: ${e.message}`),
  });

  const handleSave = () => {
    if (!selected) return;
    const updates: Record<string, string> = {};
    for (const f of EDITABLE_FIELDS) {
      const k = f.key as string;
      if (draft[k] !== ((selected[f.key] as string) ?? "")) updates[k] = draft[k];
    }
    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }
    mutation.mutate({ rowNumber: selected.rowNumber, updates });
  };

  const grouped = (data ?? []).reduce<Record<string, EventInquiry[]>>((acc, e) => {
    (acc[e.bucket] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-serif">Event Inquiries</h1>
          <p className="text-muted-foreground text-sm">Live from the Event Inquiries Google Sheet</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive mb-6">
          <CardContent className="pt-6 text-sm text-destructive">
            Failed to load inquiries: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="NEW">
        <TabsList className="mb-4 flex-wrap h-auto">
          {BUCKETS.map((b) => (
            <TabsTrigger key={b.id} value={b.id}>
              {b.label}
              <Badge variant="secondary" className="ml-2">
                {grouped[b.id]?.length ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {BUCKETS.map((b) => (
          <TabsContent key={b.id} value={b.id}>
            {isLoading ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
              </div>
            ) : (grouped[b.id]?.length ?? 0) === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No {b.label.toLowerCase()} inquiries.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {grouped[b.id].map((e) => (
                  <Card
                    key={e.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setSelected(e)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-medium truncate">{e.email || "—"}</CardTitle>
                        <span className={`text-xs px-2 py-0.5 rounded border ${statusVariant(e.bucket)}`}>
                          {e.status}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1 text-muted-foreground">
                      <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />{e.eventDate || "No date"}</div>
                      <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />{e.guests || "?"} guests · {e.reservationType || "—"}</div>
                      <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{e.startTime || "—"} → {e.endTime || "—"}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && !mutation.isPending && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3 pr-8">
                  <DialogTitle className="font-serif text-2xl flex items-center gap-3 flex-wrap">
                    {selected.email}
                    <span className={`text-xs px-2 py-0.5 rounded border ${statusVariant(selected.bucket)}`}>
                      {selected.status}
                    </span>
                  </DialogTitle>
                  {!editing && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                    </Button>
                  )}
                </div>
              </DialogHeader>

              {editing ? (
                <div className="space-y-3 text-sm">
                  <div className="text-xs text-muted-foreground">Submitted: {selected.timestamp || "—"}</div>
                  {EDITABLE_FIELDS.map((f) => (
                    <div key={f.key as string} className="space-y-1">
                      <Label htmlFor={`field-${f.key as string}`} className="text-xs uppercase tracking-wide text-muted-foreground">
                        {f.label}
                      </Label>
                      {f.type === "textarea" ? (
                        <Textarea
                          id={`field-${f.key as string}`}
                          value={draft[f.key as string] ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, [f.key as string]: e.target.value }))}
                          rows={4}
                        />
                      ) : f.type === "select" ? (
                        <Select
                          value={draft[f.key as string] ?? ""}
                          onValueChange={(v) =>
                            setDraft((d) => ({ ...d, [f.key as string]: v === "__empty__" ? "" : v }))
                          }
                        >
                          <SelectTrigger id={`field-${f.key as string}`}>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s || "__empty__"} value={s || "__empty__"}>
                                {s || "— (empty / new)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : f.type === "date" ? (
                        <Input
                          id={`field-${f.key as string}`}
                          type="date"
                          value={sheetDateToInput(draft[f.key as string] ?? "")}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [f.key as string]: inputDateToSheet(e.target.value) }))
                          }
                        />
                      ) : f.type === "time" ? (
                        <Input
                          id={`field-${f.key as string}`}
                          type="time"
                          value={sheetTimeToInput(draft[f.key as string] ?? "")}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [f.key as string]: inputTimeToSheet(e.target.value) }))
                          }
                        />
                      ) : (
                        <Input
                          id={`field-${f.key as string}`}
                          value={draft[f.key as string] ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, [f.key as string]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <Field label="Event date" value={selected.eventDate} />
                  <Field label="Submitted" value={selected.timestamp} />
                  <Field label="Guests" value={selected.guests} />
                  <Field label="Reservation type" value={selected.reservationType} />
                  <Field label="Start" value={selected.startTime} />
                  <Field label="Guest arrival" value={selected.arrivalTime} />
                  <Field label="End" value={selected.endTime} />
                  <Field label="Bar service" value={selected.barService} />
                  <Field label="Food service" value={selected.foodService} />
                  <Field label="DJ" value={selected.dj} />
                  <Field label="Budget" value={selected.budget} />
                  <Field label="Prepaid bar" value={selected.prepaid} />
                  <Field label="Notes" value={selected.description} multiline />
                  <div className="pt-2">
                    <a
                      href={`mailto:${selected.email}`}
                      className="inline-flex items-center gap-2 text-primary hover:underline"
                    >
                      <Mail className="h-4 w-4" /> Reply by email <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {editing && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditing(false)} disabled={mutation.isPending}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={mutation.isPending}>
                    {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save changes
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  if (!value) return null;
  return (
    <div className={multiline ? "" : "flex gap-3"}>
      <div className="text-muted-foreground text-xs uppercase tracking-wide w-32 shrink-0 pt-0.5">{label}</div>
      <div className={multiline ? "mt-1 whitespace-pre-wrap" : "flex-1"}>{value}</div>
    </div>
  );
}
