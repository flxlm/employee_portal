# Inventory: CAD dollar sign + per-supplier pack size

## 1. Change currency symbol

Replace the single `€` in the inventory list with `$`.

- `src/routes/_app.inventory.tsx` line 388: `€{best.cost}` → `${best.cost}`.

No other euro signs exist in inventory views.

## 2. Per-supplier pack size

Today each supplier row has `supplier`, `cost`, `notes`. A supplier may sell the item in a different pack size than the item's base unit (e.g. item unit = KG, supplier A sells 1 KG for $100, supplier B sells 2 KG for $100). Add a `pack_size` field per supplier so we can record and compare these honestly.

### Schema change

Add column to `inventory_item_suppliers`:

- `pack_size numeric NOT NULL DEFAULT 1` — how many of the item's unit are included for that supplier's `cost`.

Existing rows keep `pack_size = 1` (current behaviour preserved).

### UI changes (all in `src/routes/_app.inventory.tsx`)

**Add Item dialog (`AddItemDialog`)**

- Add a `pack_size` input next to each supplier row, suffixed with the item's `unit` (live from the Unit field above — falls back to "unit" if blank).
- Layout per row: `Supplier name | Cost ($) | Pack size (unit) | Notes | remove`.
- Default `pack_size` to `1`. Insert it into `inventory_item_suppliers` along with the existing fields.

**Suppliers & Costs dialog (`SuppliersDialog`)**

- Show a `Pack size` column with inline editing (reuse `InlineNumber`), suffixed with `item.unit`.
- "Add supplier" form gets a `Pack size` input (default 1) alongside Supplier / Cost.
- Header copy: clarify "Cost is for the listed pack size."

**Cheapest-supplier badge (line 137)**

- Change comparison from raw `cost` to **cost per unit** = `cost / pack_size` (guard divide-by-zero by treating `pack_size <= 0` as 1).
- Display stays `$<cost>` of the winning row (the actual price you pay), but selection now reflects true value.

### Files touched

- `src/routes/_app.inventory.tsx` — currency swap, AddItemDialog, SuppliersDialog, bestSupplierByItem memo.
- One migration adding `pack_size` to `inventory_item_suppliers`.

No changes to order-list, types regenerate from the migration.