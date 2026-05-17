import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MoreVertical, Search, Minus, Settings2, X, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  computeStatus,
  statusBadgeClass,
  timeAgo,
  type InventoryCategory,
  type InventoryItem,
  type InventoryItemSupplier,
  type OrderRequest,
} from "@/lib/inventory-types";

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryPage,
});

type SortKey = "name" | "status" | "updated";
const SORT_STORAGE = "inventory:sort";

const STATUS_ORDER = { OUT: 0, LOW: 1, "AT PAR": 2, OK: 3 } as const;

type ProfileRow = { id: string; full_name: string | null; email: string };

function InventoryPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [orderRequests, setOrderRequests] = useState<OrderRequest[]>([]);
  const [itemSuppliers, setItemSuppliers] = useState<InventoryItemSupplier[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>(() => {
    if (typeof window === "undefined") return "name";
    return (window.localStorage.getItem(SORT_STORAGE) as SortKey) || "name";
  });

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [flagItem, setFlagItem] = useState<InventoryItem | null>(null);
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [manageCatsOpen, setManageCatsOpen] = useState(false);
  const [suppliersItem, setSuppliersItem] = useState<InventoryItem | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(SORT_STORAGE, sort);
  }, [sort]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const loadAll = useCallback(async () => {
    const [cats, its, ors, profs, sups] = await Promise.all([
      supabase.from("inventory_categories").select("*").is("archived_at", null).order("display_order"),
      supabase.from("inventory_items").select("*").is("archived_at", null),
      supabase.from("order_requests").select("*").eq("status", "pending").order("flagged_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,email"),
      supabase.from("inventory_item_suppliers").select("*"),
    ]);
    if (cats.data) {
      setCategories(cats.data as InventoryCategory[]);
      setActiveCategory((prev) => prev || cats.data[0]?.id || "");
    }
    if (its.data) setItems(its.data as InventoryItem[]);
    if (ors.data) setOrderRequests(ors.data as OrderRequest[]);
    if (sups.data) setItemSuppliers(sups.data as InventoryItemSupplier[]);
    if (profs.data) {
      const map: Record<string, ProfileRow> = {};
      for (const p of profs.data as ProfileRow[]) map[p.id] = p;
      setProfiles(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("inventory-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_requests" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_categories" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_item_suppliers" }, () => loadAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  const userName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles[id];
    return p?.full_name || p?.email || "—";
  };

  const flaggedItemIds = useMemo(
    () => new Set(orderRequests.filter((r) => r.inventory_item_id).map((r) => r.inventory_item_id as string)),
    [orderRequests],
  );

  // Cheapest supplier per item (paired supplier+cost view)
  const bestSupplierByItem = useMemo(() => {
    const map: Record<string, InventoryItemSupplier> = {};
    for (const s of itemSuppliers) {
      const cur = map[s.item_id];
      if (!cur || Number(s.cost) < Number(cur.cost)) map[s.item_id] = s;
    }
    return map;
  }, [itemSuppliers]);

  const visibleItems = useMemo(() => {
    let rows = items.filter((i) => i.category_id === activeCategory);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((i) => i.name.toLowerCase().includes(q));
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "updated") return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      return STATUS_ORDER[computeStatus(a)] - STATUS_ORDER[computeStatus(b)];
    });
    return rows;
  }, [items, activeCategory, search, sort]);

  const updateField = async (id: string, patch: Partial<InventoryItem>) => {
    const { error } = await supabase
      .from("inventory_items")
      .update({ ...patch, updated_by: user?.id ?? null })
      .eq("id", id);
    if (error) toast.error(error.message);
  };

  const archiveItem = async (id: string) => {
    const { error } = await supabase.from("inventory_items").update({ archived_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Item archived");
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Item deleted");
  };

  if (loading) {
    return <div className="p-6">Loading inventory…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Track stock levels and flag items to reorder.</p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setManageCatsOpen(true)}>
            <Settings2 className="h-4 w-4" /> Manage categories
          </Button>
        )}
      </header>

      <div className="space-y-6">
        <PendingPanel
          requests={orderRequests}
          items={items}
          userName={userName}
          onAdHoc={() => setAdHocOpen(true)}
        />

        <div className="min-w-0">
          {categories.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">No categories yet.</Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={activeCategory} onValueChange={setActiveCategory}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="name">Sort: Name</option>
                  <option value="status">Sort: Status</option>
                  <option value="updated">Sort: Last updated</option>
                </select>
                <Button size="sm" onClick={() => setAddItemOpen(true)}>
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              </div>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Item</TableHead>
                        <TableHead className="w-24">Qty</TableHead>
                        <TableHead className="w-20">Unit</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="hidden md:table-cell">Supplier / cost</TableHead>
                        <TableHead className="w-[180px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                            No items. Click "Add item" to start.
                          </TableCell>
                        </TableRow>
                      )}
                      {visibleItems.map((it) => {
                        const status = computeStatus(it);
                        const onList = flaggedItemIds.has(it.id);
                        return (
                          <React.Fragment key={it.id}>
                            <TableRow>
                              <TableCell className="pr-0">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => toggleExpanded(it.id)}
                                  aria-label="More info"
                                >
                                  {expandedRows.has(it.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell>
                                <InlineText
                                  value={it.name}
                                  onSave={(v) => {
                                    if (v && v !== it.name && window.confirm("Rename this item? History references the name."))
                                      updateField(it.id, { name: v });
                                  }}
                                  className="font-medium"
                                />
                                {it.notes && <div className="text-xs text-muted-foreground mt-0.5">{it.notes}</div>}
                              </TableCell>
                              <TableCell>
                                <InlineNumber value={it.current_quantity} onSave={(v) => updateField(it.id, { current_quantity: v })} />
                              </TableCell>
                              <TableCell>
                                <InlineText
                                  value={it.unit}
                                  onSave={(v) => {
                                    if (window.confirm("Change unit?")) updateField(it.id, { unit: v });
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusBadgeClass(status)}>
                                  {status}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {(() => {
                                  const best = bestSupplierByItem[it.id];
                                  const count = itemSuppliers.filter((s) => s.item_id === it.id).length;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => setSuppliersItem(it)}
                                      className="text-left hover:bg-accent/40 rounded px-1 -mx-1 py-0.5 w-full"
                                    >
                                      {best ? (
                                        <>
                                          <div className="text-sm">{best.supplier}</div>
                                          <div className="text-xs text-muted-foreground tabular-nums">
                                            €{Number(best.cost).toFixed(2)}
                                            {count > 1 && <span className="ml-1 opacity-70">· +{count - 1}</span>}
                                          </div>
                                        </>
                                      ) : (
                                        <span className="text-muted-foreground text-sm">+ Add supplier</span>
                                      )}
                                    </button>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center gap-1 justify-end">
                                  <Button size="sm" variant="outline" onClick={() => setAdjustItem(it)}>
                                    Adjust
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={onList ? "ghost" : "default"}
                                    disabled={onList}
                                    onClick={() => setFlagItem(it)}
                                  >
                                    {onList ? "On order list" : "Flag"}
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="icon" variant="ghost" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => setSuppliersItem(it)}>Suppliers & costs</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => archiveItem(it.id)}>Archive</DropdownMenuItem>
                                      {isAdmin && (
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => {
                                            if (window.confirm("Permanently delete this item?")) deleteItem(it.id);
                                          }}
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                            {expandedRows.has(it.id) && (
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableCell />
                                <TableCell colSpan={6}>
                                  <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm py-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">Par:</span>
                                      <InlineNumber value={it.par_level} onSave={(v) => updateField(it.id, { par_level: v })} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">Reorder ≤:</span>
                                      <InlineNumber value={it.reorder_threshold} onSave={(v) => updateField(it.id, { reorder_threshold: v })} />
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Updated {timeAgo(it.updated_at)} · {userName(it.updated_by)}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      <AddItemDialog
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        categoryId={activeCategory}
        userId={user?.id ?? null}
      />

      <AdjustDialog
        item={adjustItem}
        onClose={() => setAdjustItem(null)}
        userId={user?.id ?? null}
      />

      <FlagDialog
        item={flagItem}
        onClose={() => setFlagItem(null)}
        userId={user?.id ?? null}
      />

      <AdHocDialog open={adHocOpen} onClose={() => setAdHocOpen(false)} userId={user?.id ?? null} />

      {isAdmin && (
        <ManageCategoriesDialog
          open={manageCatsOpen}
          onClose={() => setManageCatsOpen(false)}
          categories={categories}
        />
      )}

      <SuppliersDialog item={suppliersItem} onClose={() => setSuppliersItem(null)} />
    </div>
  );
}

function InlineText({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  if (!editing) {
    return (
      <button
        type="button"
        className={`text-left w-full hover:bg-accent/40 rounded px-1 -mx-1 py-0.5 ${className ?? ""}`}
        onClick={() => setEditing(true)}
      >
        {value || <span className="text-muted-foreground">{placeholder ?? "—"}</span>}
      </button>
    );
  }
  return (
    <Input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (v !== value) onSave(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setV(value);
          setEditing(false);
        }
      }}
      className="h-7 text-sm"
    />
  );
}

function InlineNumber({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  if (!editing) {
    return (
      <button
        type="button"
        className="text-left w-full hover:bg-accent/40 rounded px-1 -mx-1 py-0.5 tabular-nums"
        onClick={() => setEditing(true)}
      >
        {value}
      </button>
    );
  }
  return (
    <Input
      autoFocus
      type="number"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const num = Number(v);
        if (!Number.isNaN(num) && num !== value) onSave(num);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setV(String(value));
          setEditing(false);
        }
      }}
      className="h-7 text-sm w-20"
    />
  );
}

function PendingPanel({
  requests,
  items,
  userName,
  onAdHoc,
}: {
  requests: OrderRequest[];
  items: InventoryItem[];
  userName: (id: string | null) => string;
  onAdHoc: () => void;
}) {
  const itemMap = useMemo(() => {
    const m: Record<string, InventoryItem> = {};
    for (const i of items) m[i.id] = i;
    return m;
  }, [items]);

  return (
    <Card className="p-4 h-fit">
      <h2 className="font-semibold text-sm mb-1">Pending order requests</h2>
      <p className="text-xs text-muted-foreground mb-3">
        What's already been flagged for reorder. Avoid duplicates.
      </p>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {requests.length === 0 && (
          <p className="text-xs text-muted-foreground">Nothing flagged.</p>
        )}
        {requests.map((r) => {
          const name = r.inventory_item_id
            ? itemMap[r.inventory_item_id]?.name ?? "(item removed)"
            : r.ad_hoc_name ?? "Ad-hoc request";
          return (
            <div key={r.id} className="text-sm border border-border rounded-md p-2">
              <div className="font-medium">{name}</div>
              {r.quantity_needed != null && (
                <div className="text-xs text-muted-foreground">
                  Need {r.quantity_needed} {r.unit ?? ""}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {!r.inventory_item_id && <Badge variant="secondary" className="mr-1 text-[10px]">Ad-hoc</Badge>}
                {userName(r.flagged_by)} · {timeAgo(r.flagged_at)}
              </div>
              {r.notes && <div className="text-xs mt-1">{r.notes}</div>}
            </div>
          );
        })}
      </div>
      <Button size="sm" variant="outline" className="w-full mt-3" onClick={onAdHoc}>
        <Plus className="h-4 w-4" /> Add ad-hoc request
      </Button>
    </Card>
  );
}

function AddItemDialog({
  open,
  onClose,
  categoryId,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  categoryId: string;
  userId: string | null;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [qty, setQty] = useState("0");
  const [par, setPar] = useState("0");
  const [threshold, setThreshold] = useState("0");
  const [notes, setNotes] = useState("");
  const [suppliers, setSuppliers] = useState<Array<{ supplier: string; cost: string; notes: string }>>([
    { supplier: "", cost: "", notes: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setUnit(""); setQty("0"); setPar("0"); setThreshold("0"); setNotes("");
    setSuppliers([{ supplier: "", cost: "", notes: "" }]);
  };

  const updateSupplier = (i: number, patch: Partial<{ supplier: string; cost: string; notes: string }>) => {
    setSuppliers((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const submit = async () => {
    if (!name.trim() || !categoryId) {
      toast.error("Name and category required");
      return;
    }
    setSaving(true);
    const validSuppliers = suppliers.filter((s) => s.supplier.trim());
    const firstSupplier = validSuppliers[0]?.supplier.trim() || null;

    const { data: inserted, error } = await supabase
      .from("inventory_items")
      .insert({
        category_id: categoryId,
        name: name.trim(),
        unit: unit.trim(),
        current_quantity: Number(qty) || 0,
        par_level: Number(par) || 0,
        reorder_threshold: Number(threshold) || 0,
        last_supplier: firstSupplier,
        notes: notes.trim() || null,
        updated_by: userId,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      setSaving(false);
      toast.error(error?.message ?? "Failed to add item");
      return;
    }

    if (validSuppliers.length > 0) {
      const { error: supErr } = await supabase.from("inventory_item_suppliers").insert(
        validSuppliers.map((s) => ({
          item_id: inserted.id,
          supplier: s.supplier.trim(),
          cost: Number(s.cost) || 0,
          notes: s.notes.trim() || null,
        })),
      );
      if (supErr) toast.error(`Item added, but suppliers failed: ${supErr.message}`);
    }

    setSaving(false);
    toast.success("Item added");
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add inventory item</DialogTitle>
          <DialogDescription>New item in the current category.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 max-h-[70vh] overflow-y-auto pr-1">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit"><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, L, bags…" /></Field>
            <Field label="Current qty"><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Par level"><Input type="number" value={par} onChange={(e) => setPar(e.target.value)} /></Field>
            <Field label="Reorder threshold"><Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></Field>
          </div>
          <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>

          <div className="border-t pt-3">
            <Label className="text-xs">Suppliers & costs (optional)</Label>
            <div className="space-y-2 mt-1">
              {suppliers.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_1fr_auto] gap-2 items-center">
                  <Input
                    placeholder="Supplier"
                    value={s.supplier}
                    onChange={(e) => updateSupplier(i, { supplier: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Cost"
                    value={s.cost}
                    onChange={(e) => updateSupplier(i, { cost: e.target.value })}
                  />
                  <Input
                    placeholder="Notes"
                    value={s.notes}
                    onChange={(e) => updateSupplier(i, { notes: e.target.value })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setSuppliers((r) => (r.length > 1 ? r.filter((_, idx) => idx !== i) : r))}
                    disabled={suppliers.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => setSuppliers((r) => [...r, { supplier: "", cost: "", notes: "" }])}
            >
              <Plus className="h-4 w-4" /> Add another supplier
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Add item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ item, onClose, userId }: { item: InventoryItem | null; onClose: () => void; userId: string | null }) {
  const [val, setVal] = useState("0");
  useEffect(() => {
    if (item) setVal(String(item.current_quantity));
  }, [item]);

  const save = async () => {
    if (!item) return;
    const num = Number(val);
    if (Number.isNaN(num)) return;
    const { error } = await supabase
      .from("inventory_items")
      .update({ current_quantity: num, updated_by: userId })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else toast.success("Quantity updated");
    onClose();
  };

  const bump = (delta: number) => {
    const next = (Number(val) || 0) + delta;
    setVal(String(next));
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust quantity</DialogTitle>
          <DialogDescription>{item?.name}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 justify-center py-4">
          <Button variant="outline" size="icon" onClick={() => bump(-1)}><Minus className="h-4 w-4" /></Button>
          <Input
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="text-center text-2xl h-14 w-32 tabular-nums"
          />
          <Button variant="outline" size="icon" onClick={() => bump(1)}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex justify-center gap-2">
          {[-10, -5, +5, +10].map((d) => (
            <Button key={d} variant="ghost" size="sm" onClick={() => bump(d)}>
              {d > 0 ? `+${d}` : d}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FlagDialog({ item, onClose, userId }: { item: InventoryItem | null; onClose: () => void; userId: string | null }) {
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (item) {
      const need = Math.max(0, Number(item.par_level) - Number(item.current_quantity));
      setQty(need > 0 ? String(need) : "");
      setNotes("");
    }
  }, [item]);

  const submit = async () => {
    if (!item) return;
    const { error } = await supabase.from("order_requests").insert({
      inventory_item_id: item.id,
      quantity_needed: qty ? Number(qty) : null,
      unit: item.unit,
      supplier: item.last_supplier,
      notes: notes.trim() || null,
      flagged_by: userId,
      status: "pending",
    });
    if (error) toast.error(error.message);
    else toast.success("Added to order list");
    onClose();
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flag for reorder</DialogTitle>
          <DialogDescription>{item?.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label={`Quantity to order (${item?.unit || "units"})`}>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Field label="Note (optional)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Flag</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdHocDialog({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string | null }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [supplier, setSupplier] = useState("");

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Description required");
      return;
    }
    const { error } = await supabase.from("order_requests").insert({
      ad_hoc_name: name.trim(),
      quantity_needed: qty ? Number(qty) : null,
      unit: unit.trim() || null,
      supplier: supplier.trim() || null,
      notes: notes.trim() || null,
      flagged_by: userId,
      status: "pending",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request added");
    setName(""); setQty(""); setUnit(""); setNotes(""); setSupplier("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ad-hoc order request</DialogTitle>
          <DialogDescription>Not in inventory — e.g. new pan, replacement chair, repair.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Description"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. new sauté pan, ~30cm" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Qty (optional)"><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Unit (optional)"><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
          </div>
          <Field label="Supplier (optional)"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
          <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Add request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageCategoriesDialog({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: InventoryCategory[];
}) {
  const [newName, setNewName] = useState("");

  const addCategory = async () => {
    if (!newName.trim()) return;
    const order = (categories[categories.length - 1]?.display_order ?? 0) + 1;
    const { error } = await supabase
      .from("inventory_categories")
      .insert({ name: newName.trim(), display_order: order });
    if (error) toast.error(error.message);
    else {
      toast.success("Category added");
      setNewName("");
    }
  };

  const rename = async (id: string, name: string) => {
    const { error } = await supabase.from("inventory_categories").update({ name }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this category? Items will be deleted too.")) return;
    const { error } = await supabase.from("inventory_categories").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <InlineText value={c.name} onSave={(v) => v && rename(c.id, v)} className="flex-1" />
              <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-3 border-t">
          <Input
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <Button onClick={addCategory}>Add</Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function SuppliersDialog({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const [rows, setRows] = useState<InventoryItemSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_item_suppliers")
      .select("*")
      .eq("item_id", item.id)
      .order("cost", { ascending: true });
    setLoading(false);
    if (error) toast.error(error.message);
    else setRows((data ?? []) as InventoryItemSupplier[]);
  }, [item]);

  useEffect(() => {
    if (item) load();
    else setRows([]);
  }, [item, load]);

  const add = async () => {
    if (!item || !supplier.trim()) {
      toast.error("Supplier required");
      return;
    }
    const { error } = await supabase.from("inventory_item_suppliers").insert({
      item_id: item.id,
      supplier: supplier.trim(),
      cost: Number(cost) || 0,
      notes: notes.trim() || null,
    });
    if (error) toast.error(error.message);
    else {
      setSupplier(""); setCost(""); setNotes("");
      load();
    }
  };

  const updateRow = async (id: string, patch: Partial<InventoryItemSupplier>) => {
    const { error } = await supabase.from("inventory_item_suppliers").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("inventory_item_suppliers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Suppliers & costs</DialogTitle>
          <DialogDescription>{item?.name} — compare prices across suppliers.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No supplier prices recorded yet.</p>
          )}
          {rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="w-28">Cost</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <InlineText value={r.supplier} onSave={(v) => v && updateRow(r.id, { supplier: v })} />
                    </TableCell>
                    <TableCell>
                      <InlineNumber value={r.cost} onSave={(v) => updateRow(r.id, { cost: v })} />
                    </TableCell>
                    <TableCell>
                      <InlineText
                        value={r.notes ?? ""}
                        placeholder="—"
                        onSave={(v) => updateRow(r.id, { notes: v || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(r.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="border-t pt-3 grid grid-cols-[1fr_120px_1fr_auto] gap-2 items-end">
            <Field label="Supplier"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
            <Field label="Cost"><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
            <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. min order 5kg" /></Field>
            <Button onClick={add}><Plus className="h-4 w-4" /> Add</Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
