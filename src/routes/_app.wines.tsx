import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getWineList, type WineEntry } from "@/lib/sheets.functions";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search, Wine as WineIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/wines")({
  component: WinesPage,
});

function WinesPage() {
  const fetchFn = useServerFn(getWineList);
  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["wine-list"],
    queryFn: () => fetchFn(),
  });
  const [q, setQ] = useState("");
  const [colour, setColour] = useState("all");
  const [selected, setSelected] = useState<WineEntry | null>(null);

  const colours = useMemo(
    () => Array.from(new Set((data ?? []).map((w) => w.colour).filter(Boolean))),
    [data],
  );

  const filtered = (data ?? []).filter((w) => {
    if (colour !== "all" && w.colour !== colour) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return [w.name, w.domaine, w.country, w.year, w.type].some((v) => v.toLowerCase().includes(s));
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif">Wine List</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} wines · live from Google Sheets</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, domaine, country..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={colour} onValueChange={setColour}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All colours</SelectItem>
            {colours.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="border-destructive mb-4">
          <CardContent className="pt-6 text-sm text-destructive">{(error as Error).message}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Wine</th>
                  <th className="text-left px-4 py-3 font-medium">Origin</th>
                  <th className="text-left px-4 py-3 font-medium">Year</th>
                  <th className="text-left px-4 py-3 font-medium">Colour</th>
                  <th className="text-right px-4 py-3 font-medium">To-go</th>
                  <th className="text-right px-4 py-3 font-medium">Bottle</th>
                  <th className="text-right px-4 py-3 font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr
                    key={w.id}
                    className="border-t border-border hover:bg-muted/40 cursor-pointer"
                    onClick={() => setSelected(w)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{w.domaine}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{w.country}</td>
                    <td className="px-4 py-3 text-muted-foreground">{w.year}</td>
                    <td className="px-4 py-3 text-muted-foreground">{w.colour}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{w.togo || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{w.bottle || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{w.inventory || "0"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No wines match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <WineIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-xl font-serif leading-tight">{selected.name}</DialogTitle>
                    <DialogDescription className="text-sm">
                      {selected.domaine || "—"}
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {selected.colour && <Badge variant="secondary">{selected.colour}</Badge>}
                  {selected.type && <Badge variant="outline">{selected.type}</Badge>}
                  {selected.year && <Badge variant="outline">{selected.year}</Badge>}
                  {selected.country && <Badge variant="outline">{selected.country}</Badge>}
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <DetailField label="Glass" value={selected.glass} />
                <DetailField label="Bottle" value={selected.bottle} />
                <DetailField label="To-go" value={selected.togo} />
                <DetailField label="In stock" value={selected.inventory || "0"} />
                <DetailField label="Year" value={selected.year} />
                <DetailField label="Country" value={selected.country} />
                <DetailField label="Type" value={selected.type} />
                <DetailField label="Colour" value={selected.colour} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value || "—"}</div>
    </div>
  );
}
