# Inventory & Order Management

Adds a stock-tracking system to the staff portal with two pages plus a shared "pending requests" widget for non-admins.

## Pages

- **`/inventory`** — visible to all employees. Tabs per category, table per category with inline edit, ADJUST modal, FLAG FOR REORDER button. Side panel "Pending Order Requests" listing what's currently flagged (read-only summary) + ADD AD-HOC REQUEST button.
- **`/order-list`** — admin only (guarded server-side + client redirect). Groups pending items by supplier, separate "Ad-hoc Requests" section, separate "Recently Ordered" section. Actions: Mark Ordered, Remove, Edit.

Nav: add "Inventory" for everyone, "Order List" for admins (using existing `isAdmin` check in `_app.tsx`).

## Database (single migration)

Tables:
- `inventory_categories` (id, name, display_order, created_at, archived_at)
- `inventory_items` (id, category_id, name, unit, current_quantity, par_level, reorder_threshold, last_supplier, notes, updated_by, updated_at, created_at, archived_at)
- `inventory_history` (id, item_id, old_quantity, new_quantity, changed_by, changed_at) — populated via trigger on `inventory_items` quantity change
- `order_requests` (id, inventory_item_id nullable, ad_hoc_name nullable, quantity_needed, unit, notes, supplier, flagged_by, flagged_at, status enum 'pending'|'ordered'|'cancelled', ordered_by, ordered_at)

Seeds: four default categories (Food Ingredients, Drink Ingredients, Coffee Beans, Supplies).

RLS:
- All authenticated users: read everything, insert/update inventory items + categories + order_requests.
- Hard delete + status→ordered + category delete: admin only (use existing `has_role(auth.uid(), 'admin')`).
- `inventory_history`: insert via trigger only; read = authenticated.

Realtime: add `inventory_items` and `order_requests` to `supabase_realtime` publication.

## Frontend

- `src/routes/_app.inventory.tsx` — tabs, table, ADJUST modal, ADD ITEM modal, pending-requests side panel, ad-hoc modal, manage-categories modal (admin only), realtime subscription.
- `src/routes/_app.order-list.tsx` — admin guard, supplier groups, ad-hoc section, ordered history.
- Direct Supabase client queries (matches existing pattern in `_app.wines.tsx`, `_app.recipes.tsx`) — no new server functions needed since auth + RLS cover access control.
- Use shadcn `Tabs`, `Table`, `Dialog`, `Badge`, `Input`, `Button`, `DropdownMenu`.
- Status badge computed client-side from quantity vs thresholds.
- Persist sort choice in `localStorage`.

## Deferred (explicitly out of scope this turn)

- PDF export / copy-to-clipboard of order list
- Per-supplier header notes
- Bulk-edit mode
- Per-item history viewer UI (data is captured by trigger; viewing UI = phase 2)

Mobile layout will be handled with responsive Tailwind (table → stacked cards on `sm:`).

## Files touched

- New: migration, `src/routes/_app.inventory.tsx`, `src/routes/_app.order-list.tsx`
- Edited: `src/routes/_app.tsx` (nav), `src/routes/_app.home.tsx` (tile)
