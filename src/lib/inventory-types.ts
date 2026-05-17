export type InventoryCategory = {
  id: string;
  name: string;
  display_order: number;
  archived_at: string | null;
};

export type InventoryItem = {
  id: string;
  category_id: string;
  name: string;
  unit: string;
  current_quantity: number;
  par_level: number;
  reorder_threshold: number;
  last_supplier: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
  archived_at: string | null;
};

export type InventoryItemSupplier = {
  id: string;
  item_id: string;
  supplier: string;
  cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderRequest = {
  id: string;
  inventory_item_id: string | null;
  ad_hoc_name: string | null;
  quantity_needed: number | null;
  unit: string | null;
  notes: string | null;
  supplier: string | null;
  flagged_by: string | null;
  flagged_at: string;
  status: "pending" | "ordered" | "cancelled";
  ordered_by: string | null;
  ordered_at: string | null;
};

export type ItemStatus = "OK" | "AT PAR" | "LOW" | "OUT";

export function computeStatus(item: Pick<InventoryItem, "current_quantity" | "par_level" | "reorder_threshold">): ItemStatus {
  const q = Number(item.current_quantity ?? 0);
  const par = Number(item.par_level ?? 0);
  const threshold = Number(item.reorder_threshold ?? 0);
  if (q <= 0) return "OUT";
  if (q <= threshold) return "LOW";
  if (q < par) return "AT PAR";
  return "OK";
}

export function statusBadgeClass(status: ItemStatus): string {
  switch (status) {
    case "OK":
      return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
    case "AT PAR":
      return "bg-muted text-muted-foreground border-border";
    case "LOW":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
    case "OUT":
      return "bg-destructive/15 text-destructive border-destructive/30";
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
