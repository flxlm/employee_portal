CREATE TABLE public.menu_formatting (
  id TEXT PRIMARY KEY DEFAULT 'default',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_formatting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read menu formatting"
  ON public.menu_formatting
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert menu formatting"
  ON public.menu_formatting
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update menu formatting"
  ON public.menu_formatting
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.menu_formatting_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER menu_formatting_set_updated_at
BEFORE UPDATE ON public.menu_formatting
FOR EACH ROW
EXECUTE FUNCTION public.menu_formatting_touch_updated_at();

INSERT INTO public.menu_formatting (id, settings)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;