import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getEventInquiries, type EventInquiry } from "@/lib/sheets.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Calendar, Users, Clock, RefreshCw, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/events")({
  component: EventsPage,
});

const BUCKETS = [
  { id: "new", label: "New" },
  { id: "ongoing", label: "Ongoing" },
  { id: "confirmed", label: "Confirmed" },
  { id: "declined", label: "Declined" },
  { id: "past", label: "Past" },
] as const;

function statusVariant(b: EventInquiry["bucket"]) {
  switch (b) {
    case "confirmed": return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "declined": return "bg-rose-100 text-rose-900 border-rose-300";
    case "ongoing": return "bg-amber-100 text-amber-900 border-amber-300";
    case "past": return "bg-muted text-muted-foreground border-border";
    default: return "bg-sky-100 text-sky-900 border-sky-300";
  }
}

function EventsPage() {
  const fetchFn = useServerFn(getEventInquiries);
  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["event-inquiries"],
    queryFn: () => fetchFn(),
  });
  const [selected, setSelected] = useState<EventInquiry | null>(null);

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

      <Tabs defaultValue="new">
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

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl flex items-center gap-3">
                  {selected.email}
                  <span className={`text-xs px-2 py-0.5 rounded border ${statusVariant(selected.bucket)}`}>
                    {selected.status}
                  </span>
                </DialogTitle>
              </DialogHeader>
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
