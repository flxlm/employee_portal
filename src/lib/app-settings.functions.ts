import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MENU_WEBHOOK_KEY = "menu_change_webhook_url";

export async function readSettingServer(key: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.error("[app-settings] read failed", error);
    return null;
  }
  const v = (data?.value as { url?: string } | null) ?? null;
  return v?.url ?? null;
}

export const getMenuWebhookUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { url: (await readSettingServer(MENU_WEBHOOK_KEY)) ?? "" };
  });

export const setMenuWebhookUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        url: z
          .string()
          .max(2000)
          .refine(
            (v) => v === "" || /^https?:\/\//i.test(v),
            "Must be empty or an http(s) URL",
          ),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: MENU_WEBHOOK_KEY, value: { url: data.url } as never });
    if (error) throw error;
    return { ok: true };
  });

/** Fire-and-forget POST to the configured webhook URL. Safe to await. */
export async function notifyMenuChanged(): Promise<void> {
  try {
    const url = await readSettingServer(MENU_WEBHOOK_KEY);
    if (!url) return;
    const body = JSON.stringify({
      event: "menu_updated",
      timestamp: new Date().toISOString(),
    });
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    if (!res.ok) {
      console.error(
        `[notifyMenuChanged] webhook returned ${res.status} ${res.statusText}`,
      );
    }
  } catch (e) {
    console.error("[notifyMenuChanged] failed", e);
  }
}
