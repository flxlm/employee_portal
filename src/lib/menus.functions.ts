import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type MenuOption = {
  id: string;
  key: string;
  label: string;
  display_order: number;
};

export const listMenusPublic = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ menus: MenuOption[] }> => {
    const { data, error } = await supabaseAdmin
      .from("menus")
      .select("id, key, label, display_order")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { menus: (data ?? []) as MenuOption[] };
  }
);

export const listMenus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ menus: MenuOption[] }> => {
    const { data, error } = await context.supabase
      .from("menus")
      .select("id, key, label, display_order")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return { menus: (data ?? []) as MenuOption[] };
  });

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export const addMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        label: z.string().min(1).max(40),
        key: z.string().min(1).max(40).regex(/^[a-z0-9_]+$/).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }): Promise<{ menu: MenuOption }> => {
    const key = data.key ?? slugify(data.label);
    if (!key) throw new Error("Invalid menu name");

    const { data: existing } = await context.supabase
      .from("menus")
      .select("id")
      .eq("key", key)
      .maybeSingle();
    if (existing) throw new Error(`A menu with key "${key}" already exists`);

    const { data: maxRow } = await context.supabase
      .from("menus")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.display_order ?? 0) + 1;

    const { data: row, error } = await context.supabase
      .from("menus")
      .insert({ key, label: data.label, display_order: nextOrder })
      .select("id, key, label, display_order")
      .single();
    if (error) throw error;
    return { menu: row as MenuOption };
  });
