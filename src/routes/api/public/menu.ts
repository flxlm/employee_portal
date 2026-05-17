import { createFileRoute } from "@tanstack/react-router";
import { getDisplayMenu } from "@/lib/menu-display.functions";
import { getMenuFormatting } from "@/lib/menu-formatting.functions";
import { listMenuSchedulePublic } from "@/lib/menu-schedule.functions";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...CORS_HEADERS,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

export const Route = createFileRoute("/api/public/menu")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const expected =
          process.env.MENU_DISPLAY_TOKEN || "YtXYdKR1kwQYV7OeoqeuQM0PurNAxKdU";
        if (!token || token !== expected) {
          return jsonResponse({ error: "Invalid token" }, { status: 401 });
        }

        try {
          const [menu, formatting, schedule] = await Promise.all([
            getDisplayMenu({ data: {} }),
            getMenuFormatting(),
            listMenuSchedulePublic(),
          ]);

          return jsonResponse(
            {
              menu: { sections: menu.sections },
              formatting,
              schedule,
              generated_at: new Date().toISOString(),
            },
            {
              status: 200,
              headers: {
                "cache-control":
                  "public, max-age=60, stale-while-revalidate=300",
              },
            },
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/invalid display token/i.test(msg) || /token/i.test(msg)) {
            return jsonResponse({ error: "Invalid token" }, { status: 401 });
          }
          console.error("[api/public/menu] failed", e);
          return jsonResponse({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});

// PUBLIC API — consumed by external websites (e.g. savsav.net main site)
//
// GET https://staff.savsav.net/api/public/menu?token=<TOKEN>&menu=auto
//
// Response: JSON with { menu, formatting, schedule, generated_at }
// CORS: Access-Control-Allow-Origin: * (lock down per-origin if desired)
// Cache: 60s public + 5min stale-while-revalidate
//
// Query params:
//   token  (required) — same display token used by /display/$token
//   menu   (optional) — "auto" or a specific key. Currently informational; the
//                       full payload (with schedule) is returned either way so
//                       the consumer can decide which menu to show.
//
// The consumer is responsible for:
//   - Picking the right menu based on schedule (when ?menu=auto)
//   - Applying the formatting styles to its own UI
//   - Re-fetching periodically OR listening for the webhook event
//
// Cache invalidation: writes to menus call notifyMenuChanged() (see
// src/lib/app-settings.functions.ts) which POSTs { event: "menu_updated",
// timestamp } to the configured webhook URL. Configure that URL from the
// Menu Editor settings.
