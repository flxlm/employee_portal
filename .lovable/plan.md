# Menu Editor Redesign — Plan

## Goal
Replace the all-expanded, side-by-side bilingual editor with a three-level collapsible tree (Section → Subsection → Item). Everything starts collapsed; tapping drills in. All existing data, save plumbing, translation, and optimistic-insert behavior stays intact.

## Scope

### In scope (this pass)
- New collapsible tree UI inside `src/routes/_app.menu-editor.tsx`.
- Three row types matching the spec (dark brand bar / cream subsection / white item).
- Inline read-only detail panel under each expanded item showing every field as a key/value table.
- Slim page header (back link, title, "N sections · N items", View menus / More / Add buttons).
- Dashed "+ Add item" / "+ Add subsection" buttons inside expanded containers (wired to existing `addItem` / `addSubsection`).
- Per-row kebab menus: rename, edit, move up/down, hide, sold-out, duplicate, translate missing, delete. Move up/down lives **inside** the kebab now (not on the row).
- Bottom-sheet kebab on mobile, dropdown on desktop.
- All three levels collapsed on first load; independent per-row toggle state; smooth ~150ms expand/collapse with chevron rotation.

### Out of scope (explicit non-goals from spec)
- Data model / API changes.
- Drag-and-drop reordering.
- New fields.

### Decision needed — the "Edit" modal
The spec says "Edit" opens "the existing full edit modal" — but there is no edit modal today; all editing is inline (`BilingualField`, `MenuToggles`, `RowSettingsMenu`, etc.). I see two reasonable options:

**A. Build new edit modals (bigger change, matches spec literally).**
Three modals — section, subsection, item — each wrapping the current inline editors (`BilingualField` for names/descriptions, `MenuToggles` for visible menus, price input, modification editor). Save/dirty/translate plumbing keeps working unchanged because the same `queueEdit` calls are wired into the modal fields.

**B. Reuse the existing inline editors in-place (smaller change).**
The detail panel under an expanded item stays read-only as specced, but the "Edit" button toggles the panel into an editable view using the existing `BilingualField` + price input + modification list. Section/subsection editing happens the same way via their kebab → "Edit" → inline editable header.

I recommend **B** for this pass — it ships the redesign without a big modal-extraction refactor, keeps every existing behavior (translate hint, manual-override badge, do-not-translate lock, sold-out, hidden, visible-menus toggle) intact, and leaves modal extraction as a future cleanup. If you want A, say so and I'll do A.

## Technical approach

### State
- Keep existing `collapsed` (sections) and `collapsedSubs` (subsections) sets, both initialized to "all collapsed" (already done).
- Add `collapsedItems: Set<string>`, initialized to all item ids on first load.
- Add `editingId: Set<string>` for option B — toggles the inline-editor view inside an expanded item/sub/section.
- All existing refs (`dirtyRef`, `pendingInsertsRef`, `retryFnsRef`, `savingTempIds`, `failedTempIds`) untouched.

### Components (new, all internal to the file)
- `SectionRow` — dark brand bar, chevron + name + meta (`visible_menus` summary, subsection count) + kebab.
- `SubsectionRow` — cream bar, chevron + name + item count + kebab.
- `ItemRow` — white row, name + price + chevron; expands to detail panel.
- `ItemDetailPanel` — read-only two-column table of all fields; "Edit" + "Add modification" buttons at the bottom.
- `RowKebab` — wraps `DropdownMenu` on desktop, `Sheet` (side="bottom") on mobile via `useIsMobile`. Hosts move-up/move-down + existing `RowSettingsMenu` actions + Edit + Delete.

### Layout / tokens
- Max width `max-w-3xl` (≈768px) centered, per spec.
- Brand brown bar uses existing `--primary` / brown token (will check `src/styles.css`); white text.
- Subsection uses `bg-muted` (cream equivalent).
- Row min-height 44px; kebab/chevron buttons 32×32 tap area.
- Indent per level: 12px mobile, 24px desktop (via responsive padding).
- `transition-[grid-template-rows] duration-150` or `Collapsible` from `@/components/ui/collapsible` for smooth open/close.

### Header changes
- Remove inline section name editors, meal-period toggle, "Add description" from the top header — those move into section kebab → Edit (inline editable view).
- Keep dirty-changes sticky banner, save/discard, translate-all progress.

## Files touched
- `src/routes/_app.menu-editor.tsx` — full render restructure (≈ lines 1267–1945 rewritten; helpers above stay).
- No other files.

## Risks
- Large rewrite of one file — risk of dropping a hookup (e.g., `queueEdit` arg for description hint, sold-out date logic). Mitigation: reuse the exact existing handler call shapes; keep `BilingualField` / `PriceInput` / `RowSettingsMenu` / modification editors as-is and only re-arrange where they render.
- Mobile bottom-sheet kebab adds a `Sheet` import — trivial.

## Acceptance check
- Page loads with only section bars visible.
- Each level toggles independently.
- All current data accessible within one extra tap (read-only) or two (edit).
- 380px width has no horizontal scroll.
- Save / discard / translate / optimistic-insert all still work.
