CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT '',
  product TEXT NOT NULL DEFAULT '',
  recipe TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipes: authenticated read"
  ON public.recipes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Recipes: authenticated insert"
  ON public.recipes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Recipes: authenticated update"
  ON public.recipes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Recipes: admin delete"
  ON public.recipes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER recipes_set_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();