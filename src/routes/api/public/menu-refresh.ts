import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { clearDisplayCache } from "@/lib/menu-display.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Throttle: 1 request per 5 seconds (in-memory)
let lastInvokedAt = 0;

export const Route = createFileRoute("/api/public/menu-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const now = Date.now();
        if (now - lastInvokedAt < 5000) {
          return new Response("Throttled", { status: 429 });
        }

        const secret = process.env.MENU_WEBHOOK_SECRET || "savsav-menu-refresh-secret";
        const signature = request.headers.get("x-webhook-signature");
        const body = await request.text();

        if (!signature) return new Response("Missing signature", { status: 401 });

        const expected = createHmac("sha256", secret).update(body).digest("hex");
        try {
          const a = Buffer.from(signature, "utf8");
          const b = Buffer.from(expected, "utf8");
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        lastInvokedAt = now;
        clearDisplayCache();

        // Notify open displays via realtime broadcast
        try {
          const channel = supabaseAdmin.channel("menu-display");
          await channel.send({
            type: "broadcast",
            event: "refresh",
            payload: { at: new Date().toISOString() },
          });
          await supabaseAdmin.removeChannel(channel);
        } catch (e) {
          console.error("[menu-refresh] broadcast failed", e);
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
