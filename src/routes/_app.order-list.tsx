import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { timeAgo, type InventoryItem, type OrderRequest } from "@/lib/inventory-types";
import { Check, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/order-list")({
  component: OrderListPage,
});

type ProfileRow = { id: string; full_name: string | null; email: string };

function OrderListPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<OrderRequest[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [editing, setEditing] = useState<OrderRequest | null>(null);

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
    const [reqs, its, profs] = await Promise.all([
      supabase
        .from("order_requests")
        .select("*")
        .in("status", ["pending", "ordered"])
        .order("flagged_at", { ascending: false }),
      supabase.from("inventory_items").select("*"),
      supabase.from("profiles").select("id,full_name,email"),
    ]);
    if (reqs.data) setRequests(reqs.data as OrderRequest[]);
    if (its.data) setItems(its.data as InventoryItem[]);
    if (profs.data) {
      const m: Record<string, ProfileRow> = {};
      for (const p of profs.data as ProfileRow[]) m[p.id] = p;
      setProfiles(m);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin, loadAll]);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("order-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_requests" }, () => loadAll())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, loadAll]);

  const itemMap = useMemo(() => {
    const m: Record<string, InventoryItem> = {};
    for (const i of items) m[i.id] = i;
    return m;
  }, [items]);

  const userName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles[id];
    return p?.full_name || p?.email || "—";
  };

  const pending = requests.filter((r) => r.status === "pending");
  const ordered = requests.filter((r) => r.status === "ordered");

  const inventoryRequests = pending.filter((r) => r.inventory_item_id);
  const adHocRequests = pending.filter((r) => !r.inventory_item_id);

  const supplierGroups = useMemo(() => {
    const groups: Record<string, OrderRequest[]> = {};
    for (const r of inventoryRequests) {
      const supplier = r.supplier || itemMap[r.inventory_item_id!]?.last_supplier || "Unassigned";
      (groups[supplier] ??= []).push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Unassigned") return -1;
      if (b === "Unassigned") return 1;
      return a.localeCompare(b);
    });
  }, [inventoryRequests, itemMap]);

  const markOrdered = async (r: OrderRequest) => {
    const { error } = await supabase
      .from("order_requests")
      .update({ status: "ordered", ordered_by: user?.id ?? null, ordered_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else toast.success("Marked ordered");
  };

  const remove = async (r: OrderRequest) => {
    if (!window.confirm("Remove this request?")) return;
    const { error } = await supabase.from("order_requests").delete().eq("id", r.id);
    if (error) toast.error(error.message);
  };

  if (isAdmin === null) return <div className="p-6">Loading…</div>;
  if (!isAdmin) return <Navigate to="/home" />;

  const renderRow = (r: OrderRequest) => {
    const item = r.inventory_item_id ? itemMap[r.inventory_item_id] : null;
    const name = item?.name || r.ad_hoc_name || "(removed)";
    const unit = r.unit || item?.unit || "";
    return (
      <div key={r.id} className="flex items-start justify-between gap-3 py-2 border-b last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">
            {r.quantity_needed != null && `Need ${r.quantity_needed} ${unit} · `}
            {item ? "From inventory" : <Badge variant="secondary" className="text-[10px]">Ad-hoc</Badge>} · flagged by {userName(r.flagged_by)} · {timeAgo(r.flagged_at)}
          </div>
          {r.notes && <div className="text-sm mt-1">{r.notes}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => remove(r)}>
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button size="sm" onClick={() => markOrdered(r)}>
            <Check className="h-3 w-3" /> Ordered
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">Order list</h1>
        <p className="text-sm text-muted-foreground">
          Items flagged by staff, grouped by supplier. {pending.length} pending.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">By supplier</h2>
        {supplierGroups.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">No inventory items pending.</Card>
        )}
        {supplierGroups.map(([supplier, rows]) => (
          <Card key={supplier} className="p-4">
            <h3 className="font-semibold mb-1">{supplier}</h3>
            <p className="text-xs text-muted-foreground mb-2">{rows.length} item{rows.length === 1 ? "" : "s"}</p>
            <div>{rows.map(renderRow)}</div>
          </Card>
        ))}

        <h2 className="text-lg font-semibold pt-4">Ad-hoc requests</h2>
        <Card className="p-4">
          {adHocRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <div>{adHocRequests.map(renderRow)}</div>
          )}
        </Card>

        <h2 className="text-lg font-semibold pt-4">Recently ordered</h2>
        <Card className="p-4">
          {ordered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <div>
              {ordered.map((r) => {
                const item = r.inventory_item_id ? itemMap[r.inventory_item_id] : null;
                const name = item?.name || r.ad_hoc_name || "(removed)";
                return (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-b-0 text-sm">
                    <div>
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        ordered by {userName(r.ordered_by)} · {r.ordered_at ? timeAgo(r.ordered_at) : "—"}
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <EditDialog request={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditDialog({ request, onClose }: { request: OrderRequest | null; onClose: () => void }) {
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [supplier, setSupplier] = useState("");

  useEffect(() => {
    if (request) {
      setQty(request.quantity_needed != null ? String(request.quantity_needed) : "");
      setNotes(request.notes ?? "");
      setSupplier(request.supplier ?? "");
    }
  }, [request]);

  const save = async () => {
    if (!request) return;
    const { error } = await supabase
      .from("order_requests")
      .update({
        quantity_needed: qty ? Number(qty) : null,
        notes: notes.trim() || null,
        supplier: supplier.trim() || null,
      })
      .eq("id", request.id);
    if (error) toast.error(error.message);
    else toast.success("Updated");
    onClose();
  };

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit request</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Quantity</Label>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Supplier</Label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
