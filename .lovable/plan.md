# Speed up menu page load

The menu display route (`/display/$token`) and the editor pages are slow because of three independent problems: too many fonts, a fetch waterfall, and a re-rendering layout-fit loop. Fixing them in order roughly compounds: each menu page should go from multi-second to near-instant on warm cache.

## What's slow today

1. **Font flood (biggest hit).** `ensureGoogleFontsLoaded()` injects a single stylesheet that requests **~40 Google Fonts families** (Inter, Manrope, Work Sans, Playfair, etc.), even though the formatting only uses one. That's one large CSS file + dozens of WOFF2 downloads on every visit. On top, `src/styles.css` declares **27 `@font-face` blocks** for PP Neue Corp Condensed weight aliases that aren't used by the display.
2. **Client-side fetch waterfall.** `DisplayPage` mounts, then in `useEffect` kicks off `getMenuFormatting`, `getDisplayMenu`, and (in auto mode) `listMenuSchedulePublic` as separate serverFn round-trips. Nothing renders until they all return. SSR is doing no work here.
3. **`getDisplayMenu` does 4 DB queries per cold call.** The view + 3 metadata selects run in parallel, but the result is then re-merged in JS. Cache is in-memory only and dies on cold worker.
4. **Auto-fit loop thrashes layout.** After every `menus` change the effect resets `--menu-scale`, then in a `while` loop steps down by `0.02` and waits two rAFs each iteration, forcing reflow up to ~13 times. It also re-runs on every webfont load and every resize.
5. **Realtime cleanup re-imports `@/integrations/supabase/client`** dynamically on unmount, adding a small but pointless chunk fetch.

## Plan

### 1. Stop loading 40 webfonts

- Make `ensureGoogleFontsLoaded(usedFamilies?: string[])` build the Google Fonts URL from only the families currently referenced by the saved formatting (collect `formatting.global.fontFamily` and each key's `fontFamily`). Default to **none** until formatting loads, then inject one `<link>` for the used families only.
- Subset weights to the ones actually present in the formatting record instead of the full `weights` array per family.
- Add `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` in `__root.tsx` head so the first font request doesn't pay DNS + TLS cost.
- Drop the 10 per-variant alias `@font-face` blocks for PP Neue Corp Condensed (the unified family already handles weight selection). Keep PP Neue Montreal Mono.
- Preload only the primary weight of PP Neue Montreal Mono (Regular) via `<link rel="preload" as="font" type="font/otf" crossorigin>` in `__root.tsx` head; let the rest swap in.

Expected: ~1-3 s saved on first paint, especially on slow networks.

### 2. Move data fetching into the route loader (kill the waterfall)

- Convert `DisplayPage` to use a TanStack `loader` that returns `{ formatting, displayMenu, scheduleEntries }` in a single `Promise.all`. Use `loaderDeps` on the `menu` search param.
- Replace the three `useEffect`+`useServerFn` blocks with `Route.useLoaderData()`. Keep the realtime subscription and the `nowTick` interval; on `refresh` broadcasts call `router.invalidate()` instead of bumping `refreshKey` state.
- Add `pendingComponent`, `errorComponent`, `notFoundComponent`. Set `staleTime: 60_000` so back/forward and re-mounts don't re-fetch.

Expected: removes one client-render → fetch → render cycle. With SSR, HTML arrives with menu data already inlined.

### 3. Trim the display query

- Add `is_hidden`, `sold_out_date`, `visible_menus` columns directly to `menu_display_view` (one migration) so `buildMenu()` is a single `select * from menu_display_view`. Drop the three metadata round-trips and their map merging.
- Filter `is_hidden = false` server-side via the view so we don't ship hidden rows to the client at all (display never shows them anyway).
- Keep the 5-min in-memory cache; additionally cache the serialized JSON string so repeat hits skip rebuild.

Expected: cold render goes from 4 queries to 1; smaller payload to the client.

### 4. Make the auto-fit loop cheap

- Replace the per-step rAF loop with a single measurement + math: measure overflow ratio once, set `scale = clamp(MIN_SCALE, viewportHeight / contentHeight, 1)`. One reflow instead of up to 13.
- Debounce the resize handler (already 150 ms — fine) and gate the `document.fonts.ready` re-fit to only run if the chosen scale actually differs.
- Skip the effect entirely on the server (`if (typeof window === "undefined") return`).

### 5. Small cleanups

- Cache the `supabase` import at module scope inside the realtime effect so unmount doesn't dynamic-import again.
- Memoize the `mapDisplayMenuToMenus` output by `(displayMenu.generated_at, activeMenuKey)` — current `useMemo` already does this, just confirm deps are right after loader refactor.
- Add `<link rel="preload" as="video" href="/menu-animation.webm">` only on routes that use it, not globally.

## Technical notes

- `getDisplayMenu` already uses `supabaseAdmin` + a token, so it's safe to call from the loader without auth middleware. The loader runs on the server during SSR and on the client during navigation — both work with the existing serverFn.
- For the loader → invalidate flow, replace `setRefreshKey(Date.now())` in the realtime handler with `router.invalidate()`. Drop the `refreshKey` input from `getDisplayMenu` (the cache already TTLs; invalidation is a separate concern handled by `clearDisplayCache` via `refreshDisplayMenu`).
- Font subsetting: parse `fontFamily` strings like `'"Inter", sans-serif'` to extract the first quoted name, match against `FONT_OPTIONS[].label` to find the `google` slug and supported `weights`.
- The view migration is additive — no breaking change to existing readers.

## Out of scope

- Editor page (`_app.menu-editor.tsx`) perf — it's a different code path; can be a follow-up if still slow after these changes.
- Switching off OTF to WOFF2 for PP Neue (would shave more bytes, but requires asset conversion).
- Server-side rendering of the auto-fit scale (genuinely needs DOM measurement).

## Acceptance

- First paint of `/display/$token` on a cold load shows menu content in under ~1 s on a fast connection.
- Network panel shows ≤ 3 font files loaded (not 40+).
- Only one round-trip to the server for menu data on initial navigation; no client `useEffect`-driven fetch waterfall.
- Re-fit on resize triggers one reflow, not a loop.
