import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PublicWine = {
  id: string;
  name: string;
  domaine: string;
  country: string;
  colour: string;
  bottle: number;
  inventory: number;
};

export const getPublicInStockWines = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicWine[]> => {
    const { data, error } = await supabaseAdmin
      .from("wines")
      .select("id, name, domaine, country, colour, bottle, inventory")
      .gt("inventory", 0)
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      domaine: String(r.domaine ?? ""),
      country: String(r.country ?? ""),
      colour: String(r.colour ?? ""),
      bottle: Number(r.bottle ?? 0),
      inventory: Number(r.inventory ?? 0),
    }));
  },
);
