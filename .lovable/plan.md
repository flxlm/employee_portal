# Fix "Translate Missing" returning "Nothing to translate" on new items

## Root cause

When you type into a new item/section/subsection, `queueEdit` debounces a save. The server's `updateRow` runs the FR→EN auto‑translation and persists `title_en` (or `name_en`) plus a bumped `version`. But `flush()` in `src/routes/_app.menu-editor.tsx` never reloads after a successful save, so the editor keeps showing:

- `title_en = null` (stale)
- `version = N` (stale; server is now `N+1`)

That has two visible effects:

1. The "Translate Missing" menu item stays enabled because the client still thinks EN is empty. Clicking it calls the server, which reads the fresh row, sees EN is already populated, and returns `translated: 0` → toast **"Nothing to translate"**.
2. The next debounced edit on the same row sends the stale `expectedVersion`, which can trip the optimistic‑lock conflict path.

## Fix

In `src/routes/_app.menu-editor.tsx`, after a successful `flush()` (no conflicts, no errors), call `await reload()` before `triggerRefresh()`. On the conflict branch we already reload. On the all‑errors branch we leave state alone so the user can retry.

This makes the editor reflect the server‑side translation immediately:
- `title_en` / `name_en` show the translated text
- `version` is current, so subsequent edits don't conflict
- "Translate Missing" auto‑disables when there's truly nothing left to translate

## Files

- `src/routes/_app.menu-editor.tsx` — add `await reload()` in the success branch of `flush()` (around line 528–531).

No server, schema, or other UI changes needed.
