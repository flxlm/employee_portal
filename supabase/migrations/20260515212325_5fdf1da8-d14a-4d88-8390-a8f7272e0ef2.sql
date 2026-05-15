CREATE TABLE public.menu_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_schedule_dow ON public.menu_schedule(day_of_week);

ALTER TABLE public.menu_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu schedule: anon read"
  ON public.menu_schedule FOR SELECT TO anon USING (true);

CREATE POLICY "Menu schedule: auth read"
  ON public.menu_schedule FOR SELECT TO authenticated USING (true);

CREATE POLICY "Menu schedule: auth insert"
  ON public.menu_schedule FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Menu schedule: auth update"
  ON public.menu_schedule FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Menu schedule: admin delete"
  ON public.menu_schedule FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER menu_schedule_set_updated_at
  BEFORE UPDATE ON public.menu_schedule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();