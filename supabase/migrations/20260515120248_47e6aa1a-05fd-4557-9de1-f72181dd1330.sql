
-- Sections
CREATE TABLE public.menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_sections_order ON public.menu_sections(display_order) WHERE is_deleted = false;

-- Subsections
CREATE TABLE public.menu_subsections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.menu_sections(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_subsections_section ON public.menu_subsections(section_id);
CREATE INDEX idx_menu_subsections_order ON public.menu_subsections(section_id, display_order) WHERE is_deleted = false;

-- Items
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subsection_id uuid NOT NULL REFERENCES public.menu_subsections(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  base_price_cents integer NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_items_subsection ON public.menu_items(subsection_id);
CREATE INDEX idx_menu_items_order ON public.menu_items(subsection_id, display_order) WHERE is_deleted = false;

-- Modifications
CREATE TABLE public.item_modifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  modification_name text NOT NULL DEFAULT '',
  price_modifier_cents integer NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_item_modifications_item ON public.item_modifications(item_id);
CREATE INDEX idx_item_modifications_order ON public.item_modifications(item_id, display_order) WHERE is_deleted = false;

-- Updated-at triggers (reuse existing public.set_updated_at)
CREATE TRIGGER set_menu_sections_updated_at BEFORE UPDATE ON public.menu_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_menu_subsections_updated_at BEFORE UPDATE ON public.menu_subsections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_item_modifications_updated_at BEFORE UPDATE ON public.item_modifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable realtime so the editor + display can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_sections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_subsections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.item_modifications;

-- RLS
ALTER TABLE public.menu_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_subsections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu sections: auth read" ON public.menu_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Menu sections: auth insert" ON public.menu_sections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Menu sections: auth update" ON public.menu_sections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Menu sections: auth delete" ON public.menu_sections FOR DELETE TO authenticated USING (true);

CREATE POLICY "Menu subsections: auth read" ON public.menu_subsections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Menu subsections: auth insert" ON public.menu_subsections FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Menu subsections: auth update" ON public.menu_subsections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Menu subsections: auth delete" ON public.menu_subsections FOR DELETE TO authenticated USING (true);

CREATE POLICY "Menu items: auth read" ON public.menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Menu items: auth insert" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Menu items: auth update" ON public.menu_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Menu items: auth delete" ON public.menu_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "Item mods: auth read" ON public.item_modifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Item mods: auth insert" ON public.item_modifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Item mods: auth update" ON public.item_modifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Item mods: auth delete" ON public.item_modifications FOR DELETE TO authenticated USING (true);

-- Flat display view (read-only, ordered)
CREATE OR REPLACE VIEW public.menu_display_view AS
SELECT
  s.id            AS section_id,
  s.name          AS section_name,
  s.description   AS section_description,
  s.display_order AS section_order,
  ss.id           AS subsection_id,
  ss.name         AS subsection_name,
  ss.description  AS subsection_description,
  ss.display_order AS subsection_order,
  mi.id           AS item_id,
  mi.title        AS item_title,
  mi.description  AS item_description,
  mi.base_price_cents,
  mi.display_order AS item_order,
  COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'name', m.modification_name,
        'price_modifier_cents', m.price_modifier_cents,
        'order', m.display_order
      ) ORDER BY m.display_order)
      FROM public.item_modifications m
      WHERE m.item_id = mi.id AND m.is_deleted = false
    ),
    '[]'::jsonb
  ) AS modifications
FROM public.menu_sections s
LEFT JOIN public.menu_subsections ss
  ON ss.section_id = s.id AND ss.is_deleted = false
LEFT JOIN public.menu_items mi
  ON mi.subsection_id = ss.id AND mi.is_deleted = false
WHERE s.is_deleted = false
ORDER BY s.display_order, ss.display_order, mi.display_order;

GRANT SELECT ON public.menu_display_view TO anon, authenticated;

-- Seed a small sample menu
DO $$
DECLARE
  drinks_id uuid := gen_random_uuid();
  food_id uuid := gen_random_uuid();
  cocktails_id uuid := gen_random_uuid();
  mocktails_id uuid := gen_random_uuid();
  starters_id uuid := gen_random_uuid();
  negroni_id uuid := gen_random_uuid();
  spritz_id uuid := gen_random_uuid();
  virgin_id uuid := gen_random_uuid();
  burrata_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.menu_sections (id, name, description, display_order) VALUES
    (drinks_id, 'Drinks', 'Crafted in-house', 1),
    (food_id,   'Food',   'Seasonal small plates', 2);

  INSERT INTO public.menu_subsections (id, section_id, name, description, display_order) VALUES
    (cocktails_id, drinks_id, 'Cocktails', 'Signatures & classics', 1),
    (mocktails_id, drinks_id, 'Mocktails', 'Zero-proof', 2),
    (starters_id,  food_id,   'Starters',  'To share', 1);

  INSERT INTO public.menu_items (id, subsection_id, title, description, base_price_cents, display_order) VALUES
    (negroni_id, cocktails_id, 'Negroni',     'Gin, Campari, sweet vermouth', 1200, 1),
    (spritz_id,  cocktails_id, 'Aperol Spritz','Aperol, prosecco, soda',      1100, 2),
    (virgin_id,  mocktails_id, 'Virgin Mojito','Lime, mint, soda',             800,  1),
    (burrata_id, starters_id,  'Burrata',     'Heirloom tomato, basil oil',   1400, 1);

  INSERT INTO public.item_modifications (item_id, modification_name, price_modifier_cents, display_order) VALUES
    (negroni_id, 'Mezcal substitute', 200, 1),
    (burrata_id, 'Add prosciutto',    400, 1);
END $$;
