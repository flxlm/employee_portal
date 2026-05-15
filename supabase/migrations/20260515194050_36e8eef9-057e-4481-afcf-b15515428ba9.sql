CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menus: anon read" ON public.menus FOR SELECT TO anon USING (true);
CREATE POLICY "Menus: auth read" ON public.menus FOR SELECT TO authenticated USING (true);
CREATE POLICY "Menus: auth insert" ON public.menus FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Menus: auth update" ON public.menus FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Menus: auth delete" ON public.menus FOR DELETE TO authenticated USING (true);

CREATE TRIGGER menus_set_updated_at BEFORE UPDATE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.menus (key, label, display_order) VALUES
  ('breakfast', 'Breakfast', 1),
  ('lunch', 'Lunch', 2),
  ('dinner', 'Dinner', 3);
