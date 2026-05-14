import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getWineList, addWine, updateWineStock, type WineEntry } from "@/lib/sheets.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search, Wine as WineIcon, ExternalLink, Loader2, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getWineInsights } from "@/lib/wine-insights.functions";

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
  const [stock, setStock] = useState<"in" | "all">("in");
  const [selected, setSelected] = useState<WineEntry | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const colours = useMemo(
    () => Array.from(new Set((data ?? []).map((w) => w.colour).filter(Boolean))),
    [data],
  );

  const filtered = (data ?? []).filter((w) => {
    if (colour !== "all" && w.colour !== colour) return false;
    if (stock === "in") {
      const n = Number(String(w.inventory ?? "").replace(/[^0-9.\-]/g, ""));
      if (!Number.isFinite(n) || n <= 0) return false;
    }
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
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add wine
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
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
        <Select value={stock} onValueChange={(v) => setStock(v as "in" | "all")}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="in">In stock only</SelectItem>
            <SelectItem value="all">Show out of stock</SelectItem>
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
                    <td className="px-4 py-3 text-right tabular-nums">{formatPrice(w.togo)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPrice(w.bottle)}</td>
                    <td className="px-4 py-3 text-right">
                      <StockEditor wine={w} />
                    </td>
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
        <DialogContent className="max-w-xl">
          {selected && <WineDetail wine={selected} />}
        </DialogContent>
      </Dialog>

      <AddWineDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function WineDetail({ wine }: { wine: WineEntry }) {
  const insightsFn = useServerFn(getWineInsights);
  const { data: insights, isLoading, error } = useQuery({
    queryKey: ["wine-insights", wine.id],
    queryFn: () =>
      insightsFn({
        data: {
          name: wine.name,
          domaine: wine.domaine,
          year: wine.year,
          type: wine.type,
          colour: wine.colour,
          country: wine.country,
        },
      }),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <WineIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-xl font-serif leading-tight">{wine.name}</DialogTitle>
            <DialogDescription className="text-sm">{wine.domaine || "—"}</DialogDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {wine.colour && <Badge variant="secondary">{wine.colour}</Badge>}
          {wine.type && <Badge variant="outline">{wine.type}</Badge>}
          {wine.year && <Badge variant="outline">{wine.year}</Badge>}
          {wine.country && <Badge variant="outline">{wine.country}</Badge>}
        </div>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <DetailField label="Bottle" value={formatPrice(wine.bottle)} />
        <DetailField label="To-go" value={formatPrice(wine.togo)} />
        <DetailField label="In stock" value={wine.inventory || "0"} />
      </div>


      <div className="border-t border-border pt-4 mt-2 space-y-4">
        <section>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Description
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          {error ? (
            <p className="text-sm text-destructive">Couldn't load: {(error as Error).message}</p>
          ) : isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{insights?.description}</p>
          )}
        </section>

        <section>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Varietal</div>
          {isLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : insights?.varietals && insights.varietals.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {insights.varietals.map((v) => (
                <Badge key={v} variant="secondary">{v}</Badge>
              ))}
            </div>
          ) : (
            !error && <p className="text-sm text-muted-foreground">—</p>
          )}
        </section>

        {insights?.sourceUrl && (
          <a
            href={insights.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Reference
          </a>
        )}
      </div>
    </>
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

function formatPrice(value: string | undefined | null): string {
  if (value == null) return "—";
  const s = String(value).trim();
  if (!s) return "—";
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

const COLOUR_OPTIONS = ["Red", "White", "Rosé", "Sparkling", "Orange", "Dessert"];

function AddWineDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const addFn = useServerFn(addWine);
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [domaine, setDomaine] = useState("");
  const [colour, setColour] = useState("Red");
  const [inventory, setInventory] = useState("1");
  const [cost, setCost] = useState("");
  const [markup, setMarkup] = useState("2.3");
  const [togoPct, setTogoPct] = useState("35");
  const [year, setYear] = useState("");
  const [country, setCountry] = useState("");

  const costN = Number(cost);
  const markupN = Number(markup);
  const togoPctN = Number(togoPct);
  const validCost = Number.isFinite(costN) && costN > 0;
  const validMarkup = Number.isFinite(markupN) && markupN > 0;
  const validPct = Number.isFinite(togoPctN) && togoPctN >= 0 && togoPctN < 100;
  const bottleN = validCost && validMarkup ? costN * markupN : null;
  const togo = bottleN != null && validPct ? bottleN * (1 - togoPctN / 100) : null;

  function reset() {
    setName(""); setDomaine(""); setColour("Red"); setInventory("1");
    setCost(""); setMarkup("2.3"); setTogoPct("35"); setYear(""); setCountry("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !domaine.trim() || !validCost || !validMarkup || !validPct || bottleN == null) return;
    setSubmitting(true);
    try {
      await addFn({ data: {
        name: name.trim(),
        domaine: domaine.trim(),
        colour,
        inventory: Number(inventory) || 0,
        bottle: bottleN,
        markup: markupN,
        togoDiscountPct: togoPctN,
        year: year.trim(),
        country: country.trim(),
      }});
      toast.success(`Added ${name.trim()}`);
      await queryClient.invalidateQueries({ queryKey: ["wine-list"] });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message || "Failed to add wine");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Add a wine</DialogTitle>
          <DialogDescription>Appends a new row to the Wine List sheet.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="w-name">Wine name *</Label>
              <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-span-2">
              <Label htmlFor="w-dom">Producer / Domaine *</Label>
              <Input id="w-dom" value={domaine} onChange={(e) => setDomaine(e.target.value)} required />
            </div>
            <div>
              <Label>Colour *</Label>
              <Select value={colour} onValueChange={setColour}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLOUR_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="w-stock">Stock *</Label>
              <Input id="w-stock" type="number" min="0" step="1" value={inventory} onChange={(e) => setInventory(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="w-year">Year</Label>
              <Input id="w-year" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2021" />
            </div>
            <div>
              <Label htmlFor="w-country">Country</Label>
              <Input id="w-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="France" />
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="w-cost">Cost *</Label>
                <Input id="w-cost" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="20.00" required />
              </div>
              <div>
                <Label htmlFor="w-markup">Markup ×</Label>
                <Input id="w-markup" type="number" min="0.1" step="0.1" value={markup} onChange={(e) => setMarkup(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="w-pct">To-go discount %</Label>
                <Input id="w-pct" type="number" min="0" max="99" step="1" value={togoPct} onChange={(e) => setTogoPct(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm bg-muted/40 rounded-md p-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Bottle price (cost × markup)</div>
                <div className="font-medium tabular-nums">{bottleN != null ? `$${bottleN.toFixed(2)}` : "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">To-go price</div>
                <div className="font-medium tabular-nums">{togo != null ? `$${togo.toFixed(2)}` : "—"}</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting || !name.trim() || !domaine.trim() || !validCost || !validMarkup || !validPct}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add wine
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StockEditor({ wine }: { wine: WineEntry }) {
  const updateFn = useServerFn(updateWineStock);
  const queryClient = useQueryClient();
  const current = Number(String(wine.inventory ?? "").replace(/[^0-9.\-]/g, "")) || 0;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid stock number");
      return;
    }
    setSaving(true);
    try {
      await updateFn({ data: { rowNumber: wine.rowNumber, inventory: Math.floor(n) } });
      toast.success(`${wine.name}: stock set to ${Math.floor(n)}`);
      await queryClient.invalidateQueries({ queryKey: ["wine-list"] });
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message || "Failed to update stock");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setValue(String(current));
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center justify-center min-w-[2.5rem] h-8 px-2 rounded-md border text-sm font-medium tabular-nums hover:bg-accent hover:text-accent-foreground transition-colors ${
            current <= 0 ? "border-destructive/40 text-destructive" : "border-border"
          }`}
        >
          {current}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSave} className="space-y-2">
          <Label htmlFor={`stock-${wine.id}`} className="text-xs uppercase tracking-wide text-muted-foreground">
            Set stock
          </Label>
          <div className="flex gap-2">
            <Input
              id={`stock-${wine.id}`}
              type="number"
              min="0"
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              className="h-8"
            />
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

