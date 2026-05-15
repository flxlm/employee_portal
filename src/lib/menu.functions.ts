import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MenuModification = {
  id: string;
  modification_name: string;
  price_modifier_cents: number;
  display_order: number;
  version: number;
};

export type MenuItem = {
  id: string;
  subsection_id: string;
  title: string;
  description: string;
  base_price_cents: number;
  display_order: number;
  version: number;
  is_hidden: boolean;
  sold_out_date: string | null;
  modifications: MenuModification[];
};

export type MenuSubsection = {
  id: string;
  section_id: string;
  name: string;
  description: string;
  display_order: number;
  version: number;
  visible_menus: string[];
  is_hidden: boolean;
  sold_out_date: string | null;
  items: MenuItem[];
};

export type MenuSection = {
  id: string;
  name: string;
  description: string;
  display_order: number;
  version: number;
  visible_menus: string[];
  is_hidden: boolean;
  sold_out_date: string | null;
  subsections: MenuSubsection[];
};

export const listMenu = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ sections: MenuSection[] }> => {
    const { supabase } = context;
    const [sectionsRes, subsectionsRes, itemsRes, modsRes] = await Promise.all([
      supabase
        .from("menu_sections")
        .select("*")
        .eq("is_deleted", false)
        .order("display_order", { ascending: true }),
      supabase
        .from("menu_subsections")
        .select("*")
        .eq("is_deleted", false)
        .order("display_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select("*")
        .eq("is_deleted", false)
        .order("display_order", { ascending: true }),
      supabase
        .from("item_modifications")
        .select("*")
        .eq("is_deleted", false)
        .order("display_order", { ascending: true }),
    ]);

    if (sectionsRes.error) throw sectionsRes.error;
    if (subsectionsRes.error) throw subsectionsRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (modsRes.error) throw modsRes.error;

    const modsByItem = new Map<string, MenuModification[]>();
    for (const m of modsRes.data || []) {
      const arr = modsByItem.get(m.item_id) || [];
      arr.push({
        id: m.id,
        modification_name: m.modification_name,
        price_modifier_cents: m.price_modifier_cents,
        display_order: m.display_order,
        version: m.version,
      });
      modsByItem.set(m.item_id, arr);
    }

    const itemsBySub = new Map<string, MenuItem[]>();
    for (const i of itemsRes.data || []) {
      const arr = itemsBySub.get(i.subsection_id) || [];
      arr.push({
        id: i.id,
        subsection_id: i.subsection_id,
        title: i.title,
        description: i.description,
        base_price_cents: i.base_price_cents,
        display_order: i.display_order,
        version: i.version,
        is_hidden: (i as { is_hidden?: boolean }).is_hidden ?? false,
        modifications: modsByItem.get(i.id) || [],
      });
      itemsBySub.set(i.subsection_id, arr);
    }

    const subsBySec = new Map<string, MenuSubsection[]>();
    for (const ss of subsectionsRes.data || []) {
      const arr = subsBySec.get(ss.section_id) || [];
      arr.push({
        id: ss.id,
        section_id: ss.section_id,
        name: ss.name,
        description: ss.description,
        display_order: ss.display_order,
        version: ss.version,
        visible_menus: (ss as { visible_menus?: string[] }).visible_menus ?? ["breakfast", "lunch", "dinner"],
        is_hidden: (ss as { is_hidden?: boolean }).is_hidden ?? false,
        items: itemsBySub.get(ss.id) || [],
      });
      subsBySec.set(ss.section_id, arr);
    }

    const sections: MenuSection[] = (sectionsRes.data || []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      display_order: s.display_order,
      version: s.version,
      visible_menus: (s as { visible_menus?: string[] }).visible_menus ?? ["breakfast", "lunch", "dinner"],
      is_hidden: (s as { is_hidden?: boolean }).is_hidden ?? false,
      subsections: subsBySec.get(s.id) || [],
    }));

    return { sections };
  });

const TABLES = ["menu_sections", "menu_subsections", "menu_items", "item_modifications"] as const;
type TableName = (typeof TABLES)[number];

const updateInputSchema = z.object({
  table: z.enum(TABLES),
  id: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
  patch: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])
  ),
});

// Generic update with optimistic locking
export const updateRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { table, id, expectedVersion, patch } = data;

    // Strip server-managed fields
    const safe: Record<string, unknown> = { ...patch };
    delete safe.id;
    delete safe.version;
    delete safe.created_at;
    delete safe.updated_at;
    safe.version = expectedVersion + 1;

    const { data: updated, error } = await supabase
      .from(table)
      .update(safe as never)
      .eq("id", id)
      .eq("version", expectedVersion)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!updated) {
      return { ok: false as const, conflict: true as const };
    }
    console.info(`[menu] update ${table}/${id} by ${context.userId}`);
    return { ok: true as const, row: updated };
  });

const insertInputSchema = z.object({
  table: z.enum(TABLES),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export const insertRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => insertInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from(data.table)
      .insert(data.values as never)
      .select()
      .single();
    if (error) throw error;
    console.info(`[menu] insert ${data.table}/${row.id} by ${context.userId}`);
    return { row };
  });

const deleteInputSchema = z.object({
  table: z.enum(TABLES),
  id: z.string().uuid(),
});

export const softDeleteRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deleteInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from(data.table)
      .update({ is_deleted: true } as never)
      .eq("id", data.id);
    if (error) throw error;
    console.info(`[menu] soft-delete ${data.table}/${data.id} by ${context.userId}`);
    return { ok: true };
  });

const reorderSchema = z.object({
  table: z.enum(TABLES),
  orderedIds: z.array(z.string().uuid()).max(500),
});

export const reorderRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reorderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Sequential updates — small lists, fine for an editor
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await supabase
        .from(data.table)
        .update({ display_order: i + 1 } as never)
        .eq("id", data.orderedIds[i]);
      if (error) throw error;
    }
    console.info(`[menu] reorder ${data.table} (${data.orderedIds.length}) by ${context.userId}`);
    return { ok: true };
  });
