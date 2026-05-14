import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function ensureAdmin(supabase: any, userId: string) {
  if (!(await isAdmin(supabase, userId))) {
    throw new Error("Forbidden: admin only");
  }
}

export const listPasscodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("passcodes")
      .select("id, label, code, admin_only, updated_at")
      .order("admin_only", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw new Error(error.message);
    return { isAdmin: admin, passcodes: data ?? [] };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(100),
  admin_only: z.boolean(),
});

export const upsertPasscode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    if (data.id) {
      const { error } = await supabase
        .from("passcodes")
        .update({ label: data.label, code: data.code, admin_only: data.admin_only })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("passcodes")
        .insert({ label: data.label, code: data.code, admin_only: data.admin_only });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePasscode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase.from("passcodes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
