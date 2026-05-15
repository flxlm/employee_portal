import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DisplayItem = {
  id: string;
  title: string;
  description: string;
  base_price_cents: number;
  modifications: { id: string; name: string; price_modifier_cents: number }[];
};

export type DisplaySubsection = {
  id: string;
  name: string;
  description: string;
  visible_menus: string[];
  items: DisplayItem[];
};

export type DisplaySection = {
  id: string;
  name: string;
  description: string;
  visible_menus: string[];
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
  const [{ data, error }, secVis, subVis] = await Promise.all([
    supabaseAdmin.from("menu_display_view").select("*"),
    supabaseAdmin.from("menu_sections").select("id, visible_menus"),
    supabaseAdmin.from("menu_subsections").select("id, visible_menus"),
  ]);
  if (error) throw error;

  const secVisMap = new Map<string, string[]>(
    (secVis.data || []).map((r: { id: string; visible_menus: string[] | null }) => [r.id, r.visible_menus || []])
  );
  const subVisMap = new Map<string, string[]>(
    (subVis.data || []).map((r: { id: string; visible_menus: string[] | null }) => [r.id, r.visible_menus || []])
  );

  const sections = new Map<string, DisplaySection>();
  for (const row of data || []) {
    if (!row.section_id) continue;
    let sec = sections.get(row.section_id);
    if (!sec) {
      sec = {
        id: row.section_id,
        name: row.section_name || "",
        description: row.section_description || "",
        visible_menus: secVisMap.get(row.section_id) || [],
        subsections: [],
      };
      sections.set(row.section_id, sec);
    }
    if (!row.subsection_id) continue;
    let sub = sec.subsections.find((s) => s.id === row.subsection_id);
    if (!sub) {
      sub = {
        id: row.subsection_id,
        name: row.subsection_name || "",
        description: row.subsection_description || "",
        visible_menus: subVisMap.get(row.subsection_id) || [],
        items: [],
      };
      sec.subsections.push(sub);
    }
    if (!row.item_id) continue;
    if (!sub.items.find((i) => i.id === row.item_id)) {
      const mods = (Array.isArray(row.modifications) ? row.modifications : []) as Array<{
        id: string;
        name: string;
        price_modifier_cents: number;
      }>;
      sub.items.push({
        id: row.item_id,
        title: row.item_title || "",
        description: row.item_description || "",
        base_price_cents: row.base_price_cents || 0,
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
  .inputValidator((input: { token: string }) => {
    if (typeof input?.token !== "string") throw new Error("token required");
    return input;
  })
  .handler(async ({ data }) => {
    if (data.token !== DISPLAY_TOKEN) {
      throw new Error("Invalid display token");
    }
    const now = Date.now();
    const hit = cache.get("menu");
    if (hit && hit.expires > now) {
      return hit.data;
    }
    const fresh = await buildMenu();
    cache.set("menu", { data: fresh, expires: now + TTL_MS });
    return fresh;
  });
