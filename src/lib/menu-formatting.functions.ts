import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TextStyle = {
  fontFamily?: string;
  fontSize?: string; // any valid CSS value, e.g. "1.8vw" or "32px"
  fontWeight?: number | string;
  letterSpacing?: string;
  lineHeight?: string | number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  color?: string;
  fontStyle?: "normal" | "italic";
  textAlign?: "justify" | "left" | "center" | "right";
};

export type FormattingKey =
  | "global"
  | "section"
  | "subsection"
  | "itemTitle"
  | "itemDescription"
  | "modification"
  | "price"
  | "priceSuperscript"
  | "brand";

export type MenuFormatting = Partial<Record<FormattingKey, TextStyle>>;

export const DEFAULT_FORMATTING: MenuFormatting = {
  global: {
    fontFamily:
      '"PP Neue Montreal Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    textTransform: "uppercase",
    fontWeight: 500,
    color: "#000",
  },
  section: {
    fontSize: "1.8vw",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    lineHeight: 1,
    color: "#ffffff",
  },
  subsection: {
    fontSize: "2.2vw",
    fontWeight: 700,
    lineHeight: 1.1,
  },
  itemTitle: {
    fontSize: "1vw",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  itemDescription: {
    fontSize: "0.75vw",
    fontWeight: 400,
    lineHeight: 1.4,
    textAlign: "justify",
  },
  modification: {
    fontSize: "0.7vw",
    fontWeight: 400,
    lineHeight: 1.4,
  },
  price: {
    fontWeight: 700,
  },
  priceSuperscript: {
    fontSize: "0.55em",
    fontWeight: 700,
  },
  brand: {
    fontSize: "1.6vw",
    fontWeight: 700,
    fontStyle: "italic",
  },
};

export const getMenuFormatting = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("menu_formatting")
      .select("settings")
      .eq("id", "default")
      .maybeSingle();
    if (error) throw error;
    const settings = (data?.settings as MenuFormatting) || {};
    return settings;
  },
);

export const saveMenuFormatting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { settings: MenuFormatting }) => {
    if (!input || typeof input.settings !== "object") {
      throw new Error("settings required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("menu_formatting")
      .upsert({ id: "default", settings: data.settings as never });
    if (error) throw error;
    return { ok: true };
  });
