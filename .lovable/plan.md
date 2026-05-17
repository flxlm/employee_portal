# Speed up "Add item" in the menu editor

## What's slow today

Clicking **Add item** runs this sequence before anything appears on screen:

1. Call the `insertRow` server function (auth middleware + Supabase `insert ... select().single()` round trip — typically 300–800 ms).
2. `await` the response.
3. Append the returned row to local state, then render.
4. Fire `triggerRefresh()` for the live display (already non-blocking — fine).

So the entire perceived latency = one server round trip. The user clicks, then waits, then sees the new row. Same pattern is used by `addSubsection`, `addSection`, and `addMod`.

## The fix: optimistic insert

Render the new item **immediately** with a client-generated temp id, send the insert in the background, then reconcile when the server responds. The user perceives the add as instant.

### Behavior

- Click "Add item" → a new row appears in the list within one frame, already focused on the title input so the user can start typing.
- In the background, `insertRow` runs. On success, swap the temp row for the real one (preserving any edits the user already typed — those edits flow through the existing dirty-row autosave path, just keyed on the real id once we have it).
- On failure, remove the temp row and toast an error.

### Edits that arrive before the server insert finishes

Two safe options — pick one:

- **Option A (simpler):** disable the title/price inputs on the temp row until the real id arrives (typically <500 ms). Visually it still feels instant; only typing is briefly blocked.
- **Option B (smoother):** allow typing into the temp row, queue any field changes against the temp id, and once the real id arrives, replay the queued patch via `updateRow`. More code, no input lockout.

Recommend Option A first — it captures ~95% of the perceived-speed win with minimal risk.

### Apply the same pattern to siblings

`addSection`, `addSubsection`, and `addMod` have identical structure. Same change, same payoff.

## Other small wins (optional)

- The `insertRow` server fn does `.insert(...).select().single()`. We only need the new `id` and `version` for client reconciliation, so we could `.select("id, version, display_order")` instead of `*` — marginal, but cheaper payload.
- Nothing else on the hot path is worth touching. `triggerRefresh()` is already fire-and-forget. There's no extra `reload()` after add.

## Technical details

Files to change:

- `src/routes/_app.menu-editor.tsx`
  - `addItem` (line 629), `addSubsection` (619), `addSection` (613), `addMod` (639): switch to optimistic insert.
  - Use `crypto.randomUUID()` for the temp id. Mark the row with a `__pending: true` flag (or track temp ids in a `Set<string>`) so the UI can disable inputs / show a subtle spinner.
  - On server response: `setSections` mapping that replaces the temp id with the real row (keep `modifications: []` / `items: []`). On error: remove the temp row and `toast.error`.
- `src/lib/menu.functions.ts` (optional): narrow the `.select()` in `insertRow` to just the columns the client needs.

No schema changes, no server-function signature changes (still returns `{ row }`).

## Expected impact

Perceived "Add item" latency drops from one server round trip (~300–800 ms) to a single frame (~16 ms). Real DB write still happens at the same speed in the background.
