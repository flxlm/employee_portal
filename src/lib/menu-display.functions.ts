import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DisplayItem = {
  id: string;
  title: string;
  description: string;
  base_price_cents: number;
  is_hidden: boolean;
  sold_out_date: string | null;
  modifications: { id: string; name: string; price_modifier_cents: number }[];
};

export type DisplaySubsection = {
  id: string;
  name: string;
  description: string;
  visible_menus: string[];
  is_hidden: boolean;
  sold_out_date: string | null;
  items: DisplayItem[];
};

export type DisplaySection = {
  id: string;
  name: string;
  description: string;
  visible_menus: string[];
  is_hidden: boolean;
  sold_out_date: string | null;
  subsections: DisplaySubsection[];
};

export type DisplayMenu = {
  sections: DisplaySection[];
  generated_at: string;
};

// Display token (rotate by changing here or wiring an env var)
const DISPLAY_TOKEN = process.env.MENU_DISPLAY_TOKEN || "YtXYdKR1kwQYV7OeoqeuQM0PurNAxKdU";

// In-memory cache (5-min TTL). Fine on a single warm worker; cold starts will re-fetch.
type CacheEntry = { data: DisplayMenu; expires: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 5 * 60 * 1000;

export function clearDisplayCache() {
  cache.clear();
}

async function buildMenu(): Promise<DisplayMenu> {
  const { data, error } = await supabaseAdmin.from("menu_display_view").select("*");
  if (error) throw error;

  const sections = new Map<string, DisplaySection>();
  for (const row of (data || []) as Array<Record<string, unknown>>) {
    const sectionId = row.section_id as string | null;
    if (!sectionId) continue;
    let sec = sections.get(sectionId);
    if (!sec) {
      sec = {
        id: sectionId,
        name: (row.section_name as string) || "",
        description: (row.section_description as string) || "",
        visible_menus: (row.section_visible_menus as string[] | null) || [],
        is_hidden: !!row.section_is_hidden,
        sold_out_date: (row.section_sold_out_date as string | null) ?? null,
        subsections: [],
      };
      sections.set(sectionId, sec);
    }
    const subId = row.subsection_id as string | null;
    if (!subId) continue;
    let sub = sec.subsections.find((s) => s.id === subId);
    if (!sub) {
      sub = {
        id: subId,
        name: (row.subsection_name as string) || "",
        description: (row.subsection_description as string) || "",
        visible_menus: sec.visible_menus,
        is_hidden: !!row.subsection_is_hidden,
        sold_out_date: (row.subsection_sold_out_date as string | null) ?? null,
        items: [],
      };
      sec.subsections.push(sub);
    }
    const itemId = row.item_id as string | null;
    if (!itemId) continue;
    if (!sub.items.find((i) => i.id === itemId)) {
      const mods = (Array.isArray(row.modifications) ? row.modifications : []) as Array<{
        id: string;
        name: string;
        price_modifier_cents: number;
      }>;
      sub.items.push({
        id: itemId,
        title: (row.item_title as string) || "",
        description: (row.item_description as string) || "",
        base_price_cents: (row.base_price_cents as number) || 0,
        is_hidden: !!row.item_is_hidden,
        sold_out_date: (row.item_sold_out_date as string | null) ?? null,
        modifications: mods.map((m) => ({
          id: m.id,
          name: m.name,
          price_modifier_cents: m.price_modifier_cents,
        })),
      });
    }
  }

  return {
    sections: Array.from(sections.values()),
    generated_at: new Date().toISOString(),
  };
}

export const getDisplayMenu = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string; refreshKey?: number }) => {
    if (typeof input?.token !== "string") throw new Error("token required");
    return input;
  })
  .handler(async ({ data }) => {
    if (data.token !== DISPLAY_TOKEN) {
      throw new Error("Invalid display token");
    }
    const now = Date.now();
    const hit = cache.get("menu");
    if (!data.refreshKey && hit && hit.expires > now) {
      return hit.data;
    }
    const fresh = await buildMenu();
    cache.set("menu", { data: fresh, expires: now + TTL_MS });
    return fresh;
  });

export const refreshDisplayMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    clearDisplayCache();
    try {
      const channel = supabaseAdmin.channel("menu-display");
      await channel.send({
        type: "broadcast",
        event: "refresh",
        payload: { at: new Date().toISOString() },
      });
      await supabaseAdmin.removeChannel(channel);
    } catch (e) {
      console.error("[refreshDisplayMenu] broadcast failed", e);
    }
    // Fire-and-forget external webhook (e.g. savsav.net marketing site).
    try {
      const { notifyMenuChanged } = await import("@/lib/app-settings.functions");
      await notifyMenuChanged();
    } catch (e) {
      console.error("[refreshDisplayMenu] notify failed", e);
    }
    return { ok: true };
  });

/**
 * Public cache-buster: lets the client tell the server "the cached menu is stale, rebuild it".
 * Used by the display screen after it receives a realtime "refresh" broadcast so any other
 * warm worker that didn't process the write still serves fresh data on the next loader run.
 */
export const invalidateDisplayMenuCache = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => {
    if (typeof input?.token !== "string") throw new Error("token required");
    return input;
  })
  .handler(async ({ data }) => {
    if (data.token !== DISPLAY_TOKEN) throw new Error("Invalid display token");
    clearDisplayCache();
    return { ok: true };
  });

export const refreshWebsiteMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const url = process.env.WEBSITE_REFRESH_URL;
    const secret = process.env.WEBSITE_REFRESH_SECRET;
    if (!url || !secret) {
      throw new Error("Website refresh is not configured");
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Refresh-Secret": secret,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Website refresh failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = (await res.json().catch(() => ({}))) as { refreshed_at?: string };
    return { ok: true as const, refreshed_at: data.refreshed_at ?? new Date().toISOString() };
  });
