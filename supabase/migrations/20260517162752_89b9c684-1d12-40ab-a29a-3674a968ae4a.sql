CREATE TABLE IF NOT EXISTS public.menu_schedule_specials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key text NOT NULL,
  slot_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menu_schedule_specials_slot_date_idx
  ON public.menu_schedule_specials (slot_date);

ALTER TABLE public.menu_schedule_specials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Specials: anon read upcoming"
  ON public.menu_schedule_specials
  FOR SELECT
  TO anon
  USING (slot_date >= CURRENT_DATE);

CREATE POLICY "Specials: auth read upcoming"
  ON public.menu_schedule_specials
  FOR SELECT
  TO authenticated
  USING (slot_date >= CURRENT_DATE);

CREATE POLICY "Specials: admin insert"
  ON public.menu_schedule_specials
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Specials: admin update"
  ON public.menu_schedule_specials
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Specials: admin delete"
  ON public.menu_schedule_specials
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER menu_schedule_specials_set_updated_at
  BEFORE UPDATE ON public.menu_schedule_specials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
