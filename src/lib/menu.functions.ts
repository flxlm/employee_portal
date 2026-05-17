import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Lang = "fr" | "en";

export type BilingualField = {
  en: string | null;
  source_lang: Lang;
  translated_from: string | null;
  is_manual_override: boolean;
};

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
  title_en: string | null;
  title_source_lang: Lang;
  title_translated_from: string | null;
  title_is_manual_override: boolean;
  description: string;
  description_en: string | null;
  description_source_lang: Lang;
  description_translated_from: string | null;
  description_is_manual_override: boolean;
  do_not_translate: boolean;
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
  name_en: string | null;
  name_source_lang: Lang;
  name_translated_from: string | null;
  name_is_manual_override: boolean;
  description: string;
  description_en: string | null;
  description_source_lang: Lang;
  description_translated_from: string | null;
  description_is_manual_override: boolean;
  do_not_translate: boolean;
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
  name_en: string | null;
  name_source_lang: Lang;
  name_translated_from: string | null;
  name_is_manual_override: boolean;
  description: string;
  description_en: string | null;
  description_source_lang: Lang;
  description_translated_from: string | null;
  description_is_manual_override: boolean;
  do_not_translate: boolean;
  display_order: number;
  version: number;
  visible_menus: string[];
  is_hidden: boolean;
  sold_out_date: string | null;
  subsections: MenuSubsection[];
};

const TRANSLATABLE_BY_TABLE: Record<string, readonly string[]> = {
  menu_items: ["title", "description"],
  menu_subsections: ["name", "description"],
  menu_sections: ["name", "description"],
};

function fieldType(table: string, field: string): string {
  if (table === "menu_items") return field === "title" ? "item_name" : "item_description";
  if (table === "menu_subsections")
    return field === "name" ? "subsection_name" : "subsection_description";
  return field === "name" ? "section_name" : "section_description";
}

async function callLovableTranslate(args: {
  text: string;
  source_lang: Lang;
  target_lang: Lang;
  type: string;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const LANG = { fr: "French", en: "English" } as const;
  const system = `You are a professional menu translator for a Montreal café. Translate menu text from ${LANG[args.source_lang]} to ${LANG[args.target_lang]}. Rules:
- Keep the translation concise and natural for a ${LANG[args.target_lang]}-speaking customer.
- Preserve loanwords commonly used in both languages (e.g. "gravlax" stays "gravlax", "baguette" stays "baguette").
- For item names, prefer short, evocative translations.
- Match the SAME formatting as the input: ALL CAPS in → ALL CAPS out; sentence case in → sentence case out.
- Never translate brand or proper names (e.g. "Savsav").
- Never include explanations, alternatives, or quotation marks. Return ONLY the translation, nothing else.`;
  const user = `Translate this ${args.type.replace(/_/g, " ")} from ${LANG[args.source_lang]} to ${LANG[args.target_lang]}:\n\n${args.text}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 200,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Lovable AI gateway ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? "").trim();
}

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
      const r = i as Record<string, unknown>;
      arr.push({
        id: i.id,
        subsection_id: i.subsection_id,
        title: i.title,
        title_en: (r.title_en as string | null) ?? null,
        title_source_lang: ((r.title_source_lang as Lang) ?? "fr"),
        title_translated_from: (r.title_translated_from as string | null) ?? null,
        title_is_manual_override: (r.title_is_manual_override as boolean) ?? false,
        description: i.description,
        description_en: (r.description_en as string | null) ?? null,
        description_source_lang: ((r.description_source_lang as Lang) ?? "fr"),
        description_translated_from: (r.description_translated_from as string | null) ?? null,
        description_is_manual_override: (r.description_is_manual_override as boolean) ?? false,
        do_not_translate: (r.do_not_translate as boolean) ?? false,
        base_price_cents: i.base_price_cents,
        display_order: i.display_order,
        version: i.version,
        is_hidden: (r.is_hidden as boolean) ?? false,
        sold_out_date: (r.sold_out_date as string | null) ?? null,
        modifications: modsByItem.get(i.id) || [],
      });
      itemsBySub.set(i.subsection_id, arr);
    }

    const subsBySec = new Map<string, MenuSubsection[]>();
    for (const ss of subsectionsRes.data || []) {
      const arr = subsBySec.get(ss.section_id) || [];
      const r = ss as Record<string, unknown>;
      arr.push({
        id: ss.id,
        section_id: ss.section_id,
        name: ss.name,
        name_en: (r.name_en as string | null) ?? null,
        name_source_lang: ((r.name_source_lang as Lang) ?? "fr"),
        name_translated_from: (r.name_translated_from as string | null) ?? null,
        name_is_manual_override: (r.name_is_manual_override as boolean) ?? false,
        description: ss.description,
        description_en: (r.description_en as string | null) ?? null,
        description_source_lang: ((r.description_source_lang as Lang) ?? "fr"),
        description_translated_from: (r.description_translated_from as string | null) ?? null,
        description_is_manual_override: (r.description_is_manual_override as boolean) ?? false,
        do_not_translate: (r.do_not_translate as boolean) ?? false,
        display_order: ss.display_order,
        version: ss.version,
        visible_menus: (r.visible_menus as string[] | undefined) ?? ["breakfast", "lunch", "dinner"],
        is_hidden: (r.is_hidden as boolean) ?? false,
        sold_out_date: (r.sold_out_date as string | null) ?? null,
        items: itemsBySub.get(ss.id) || [],
      });
      subsBySec.set(ss.section_id, arr);
    }

    const sections: MenuSection[] = (sectionsRes.data || []).map((s) => {
      const r = s as Record<string, unknown>;
      return {
        id: s.id,
        name: s.name,
        name_en: (r.name_en as string | null) ?? null,
        name_source_lang: ((r.name_source_lang as Lang) ?? "fr"),
        name_translated_from: (r.name_translated_from as string | null) ?? null,
        name_is_manual_override: (r.name_is_manual_override as boolean) ?? false,
        description: s.description,
        description_en: (r.description_en as string | null) ?? null,
        description_source_lang: ((r.description_source_lang as Lang) ?? "fr"),
        description_translated_from: (r.description_translated_from as string | null) ?? null,
        description_is_manual_override: (r.description_is_manual_override as boolean) ?? false,
        do_not_translate: (r.do_not_translate as boolean) ?? false,
        display_order: s.display_order,
        version: s.version,
        visible_menus: (r.visible_menus as string[] | undefined) ?? ["breakfast", "lunch", "dinner"],
        is_hidden: (r.is_hidden as boolean) ?? false,
        sold_out_date: (r.sold_out_date as string | null) ?? null,
        subsections: subsBySec.get(s.id) || [],
      };
    });

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

    // Bilingual translation logic for translatable menu tables
    const fields = TRANSLATABLE_BY_TABLE[table];
    if (fields) {
      const { data: cur } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      const current = cur as Record<string, unknown> | null;
      if (current) {
        const togglingDoNotTranslate = Object.prototype.hasOwnProperty.call(
          safe,
          "do_not_translate",
        );
        const doNotTranslate = (
          togglingDoNotTranslate ? safe.do_not_translate : current.do_not_translate
        ) as boolean;

        const ops: Array<Promise<void>> = [];
        for (const f of fields) {
          const enKey = `${f}_en`;
          const srcKey = `${f}_source_lang`;
          const transFromKey = `${f}_translated_from`;
          const overrideKey = `${f}_is_manual_override`;
          const hintKey = `${f}_source_lang_hint`;

          const hasFr = Object.prototype.hasOwnProperty.call(safe, f);
          const hasEn = Object.prototype.hasOwnProperty.call(safe, enKey);
          const hint = safe[hintKey] as Lang | undefined;
          delete safe[hintKey];

          // If just toggling do_not_translate (no text edits), still process to mirror
          if (!hasFr && !hasEn && !togglingDoNotTranslate) continue;

          const newFr = hasFr ? String(safe[f] ?? "") : String(current[f] ?? "");
          const newEn = hasEn ? String(safe[enKey] ?? "") : String(current[enKey] ?? "");
          const curFr = String(current[f] ?? "");
          const curEn = String(current[enKey] ?? "");
          const curSrc = ((current[srcKey] as Lang) ?? "fr") as Lang;
          const curOverride = !!current[overrideKey];

          if (doNotTranslate) {
            const sourceLang: Lang = hint ?? curSrc;
            const sourceText = sourceLang === "fr" ? newFr : newEn;
            safe[f] = sourceText;
            safe[enKey] = sourceText;
            safe[srcKey] = sourceLang;
            safe[transFromKey] = sourceText;
            safe[overrideKey] = false;
            continue;
          }

          const frChanged = newFr !== curFr;
          const enChanged = newEn !== curEn;
          if (!frChanged && !enChanged) {
            delete safe[f];
            delete safe[enKey];
            continue;
          }

          let sourceLang: Lang;
          if (frChanged && !enChanged) sourceLang = "fr";
          else if (enChanged && !frChanged) sourceLang = "en";
          else sourceLang = hint ?? curSrc;

          const sourceChanged = sourceLang === "fr" ? frChanged : enChanged;
          const nonSourceChanged = sourceLang === "fr" ? enChanged : frChanged;

          if (nonSourceChanged && !sourceChanged) {
            safe[f] = newFr;
            safe[enKey] = newEn;
            safe[srcKey] = curSrc;
            safe[overrideKey] = true;
            continue;
          }
          if (nonSourceChanged && sourceChanged) {
            safe[f] = newFr;
            safe[enKey] = newEn;
            safe[srcKey] = sourceLang;
            safe[transFromKey] = sourceLang === "fr" ? newFr : newEn;
            safe[overrideKey] = true;
            continue;
          }
          // Only source changed
          if (curOverride) {
            safe[f] = newFr;
            safe[enKey] = newEn;
            safe[srcKey] = sourceLang;
            continue;
          }
          // Translate
          const sourceText = sourceLang === "fr" ? newFr : newEn;
          const targetLang: Lang = sourceLang === "fr" ? "en" : "fr";
          if (!sourceText.trim()) {
            safe[f] = newFr;
            safe[enKey] = newEn;
            safe[srcKey] = sourceLang;
            safe[transFromKey] = sourceText;
            safe[overrideKey] = false;
            continue;
          }
          ops.push(
            callLovableTranslate({
              text: sourceText,
              source_lang: sourceLang,
              target_lang: targetLang,
              type: fieldType(table, f),
            })
              .then((translated) => {
                if (sourceLang === "fr") {
                  safe[f] = newFr;
                  safe[enKey] = translated;
                } else {
                  safe[enKey] = newEn;
                  safe[f] = translated;
                }
                safe[srcKey] = sourceLang;
                safe[transFromKey] = sourceText;
                safe[overrideKey] = false;
              })
              .catch((err) => {
                console.error(
                  `[menu] translate failed for ${table}/${id}/${f}:`,
                  err,
                );
                // Save source side as-is; leave non-source untouched
                if (sourceLang === "fr") {
                  safe[f] = newFr;
                  delete safe[enKey];
                } else {
                  safe[enKey] = newEn;
                  delete safe[f];
                }
                safe[srcKey] = sourceLang;
                safe[transFromKey] = sourceText;
              }),
          );
        }
        await Promise.all(ops);
      }
    }

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
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])),
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

const translateMissingSchema = z.object({
  table: z.enum(["menu_sections", "menu_subsections", "menu_items"] as const),
  id: z.string().uuid(),
});

export const translateMissingRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => translateMissingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { table, id } = data;
    const fields = TRANSLATABLE_BY_TABLE[table];
    if (!fields) return { ok: true as const, translated: 0 };

    const { data: cur, error: readErr } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!cur) return { ok: false as const, translated: 0 };
    const current = cur as Record<string, unknown>;
    if (current.do_not_translate) return { ok: true as const, translated: 0 };

    const patch: Record<string, unknown> = {};
    let translated = 0;
    for (const f of fields) {
      const enKey = `${f}_en`;
      const srcKey = `${f}_source_lang`;
      const transFromKey = `${f}_translated_from`;
      const overrideKey = `${f}_is_manual_override`;
      const fr = String(current[f] ?? "").trim();
      const en = String(current[enKey] ?? "").trim();
      if (fr && en) continue;
      if (!fr && !en) continue;
      const sourceLang: Lang = fr ? "fr" : "en";
      const targetLang: Lang = sourceLang === "fr" ? "en" : "fr";
      const sourceText = sourceLang === "fr" ? fr : en;
      try {
        const out = await callLovableTranslate({
          text: sourceText,
          source_lang: sourceLang,
          target_lang: targetLang,
          type: fieldType(table, f),
        });
        if (sourceLang === "fr") patch[enKey] = out;
        else patch[f] = out;
        patch[srcKey] = sourceLang;
        patch[transFromKey] = sourceText;
        patch[overrideKey] = false;
        translated++;
      } catch (err) {
        console.error(`[menu] translateMissing failed for ${table}/${id}/${f}:`, err);
      }
    }

    if (translated === 0) return { ok: true as const, translated: 0 };
    const currentVersion = Number(current.version ?? 0);
    patch.version = currentVersion + 1;
    const { error: updErr } = await supabase
      .from(table)
      .update(patch as never)
      .eq("id", id)
      .eq("version", currentVersion);
    if (updErr) throw updErr;
    console.info(`[menu] translateMissing ${table}/${id} (${translated}) by ${context.userId}`);
    return { ok: true as const, translated };
  });

export const translateAllMissing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const tables = ["menu_sections", "menu_subsections", "menu_items"] as const;
    let rowsTouched = 0;
    let fieldsTranslated = 0;
    let failures = 0;

    for (const table of tables) {
      const fields = TRANSLATABLE_BY_TABLE[table];
      const { data: rows, error } = await supabase
        .from(table)
        .select("*")
        .eq("is_deleted", false);
      if (error) throw error;
      for (const r of rows || []) {
        const current = r as Record<string, unknown>;
        if (current.do_not_translate) continue;
        const patch: Record<string, unknown> = {};
        let translated = 0;
        for (const f of fields) {
          const enKey = `${f}_en`;
          const srcKey = `${f}_source_lang`;
          const transFromKey = `${f}_translated_from`;
          const overrideKey = `${f}_is_manual_override`;
          const fr = String(current[f] ?? "").trim();
          const en = String(current[enKey] ?? "").trim();
          if (fr && en) continue;
          if (!fr && !en) continue;
          const sourceLang: Lang = fr ? "fr" : "en";
          const targetLang: Lang = sourceLang === "fr" ? "en" : "fr";
          const sourceText = sourceLang === "fr" ? fr : en;
          try {
            const out = await callLovableTranslate({
              text: sourceText,
              source_lang: sourceLang,
              target_lang: targetLang,
              type: fieldType(table, f),
            });
            if (sourceLang === "fr") patch[enKey] = out;
            else patch[f] = out;
            patch[srcKey] = sourceLang;
            patch[transFromKey] = sourceText;
            patch[overrideKey] = false;
            translated++;
          } catch (err) {
            console.error(`[menu] translateAll failed for ${table}/${current.id}/${f}:`, err);
            failures++;
          }
        }
        if (translated === 0) continue;
        const currentVersion = Number(current.version ?? 0);
        patch.version = currentVersion + 1;
        const { error: updErr } = await supabase
          .from(table)
          .update(patch as never)
          .eq("id", current.id as string)
          .eq("version", currentVersion);
        if (updErr) {
          console.error(`[menu] translateAll update failed for ${table}/${current.id}:`, updErr);
          failures++;
          continue;
        }
        rowsTouched++;
        fieldsTranslated += translated;
      }
    }
    console.info(`[menu] translateAllMissing rows=${rowsTouched} fields=${fieldsTranslated} failures=${failures} by ${context.userId}`);
    return { ok: true as const, rowsTouched, fieldsTranslated, failures };
  });
