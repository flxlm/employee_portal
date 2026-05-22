// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=30",
};

const defaultPayload = { is_enabled: false };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify(defaultPayload), { headers: jsonHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("announcements")
      .select(
        "is_enabled, message, link_url, link_text, background_color, text_color",
      )
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify(defaultPayload), { headers: jsonHeaders });
    }

    return new Response(
      JSON.stringify({
        is_enabled: !!data.is_enabled,
        message: data.message ?? "",
        link_url: data.link_url ?? null,
        link_text: data.link_text ?? null,
        background_color: data.background_color ?? "#000000",
        text_color: data.text_color ?? "#FFFFFF",
      }),
      { headers: jsonHeaders },
    );
  } catch (_err) {
    return new Response(JSON.stringify(defaultPayload), { headers: jsonHeaders });
  }
});
