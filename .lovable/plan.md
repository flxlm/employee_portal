# Make "Refresh website" also refresh live menus

Today the **Refresh website** action in the menu editor only pings the marketing site. The in-store / live menu screens are refreshed separately whenever you save an edit. This change makes the button do both at once.

## Behavior after the change

When you click **Refresh website**:
1. The marketing website menu is refreshed (current behavior).
2. The live menu displays are also refreshed (new — same action that already runs after every save).
3. Toast shows "Website and live menus refreshed".

If the website refresh fails, the live menus are still refreshed and the error toast mentions only the website failure.

## Technical detail

In `src/routes/_app.menu-editor.tsx`, update `handleRefreshWebsite` to also invoke the existing `triggerRefresh()` (which calls `refreshDisplayMenu`) alongside the existing `refreshWebsite({})` call. No new server functions, no schema changes.
