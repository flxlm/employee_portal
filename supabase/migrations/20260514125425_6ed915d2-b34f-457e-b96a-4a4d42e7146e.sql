-- Event inquiries table (mirror of Jotform sheet, source of truth from now on)
CREATE TABLE public.event_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id text UNIQUE,
  submission_date text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  event_date_raw text NOT NULL DEFAULT '',
  event_date date,
  new_date_raw text NOT NULL DEFAULT '',
  guests text NOT NULL DEFAULT '',
  reservation_type text NOT NULL DEFAULT '',
  start_time text NOT NULL DEFAULT '',
  arrival_time text NOT NULL DEFAULT '',
  end_time text NOT NULL DEFAULT '',
  bar_service text NOT NULL DEFAULT '',
  food_service text NOT NULL DEFAULT '',
  dj text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  budget text NOT NULL DEFAULT '',
  prepaid text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_inquiries_status_idx ON public.event_inquiries (status);
CREATE INDEX event_inquiries_event_date_idx ON public.event_inquiries (event_date);
CREATE INDEX event_inquiries_submission_date_idx ON public.event_inquiries (submission_date);

ALTER TABLE public.event_inquiries ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all inquiries (matches current app behavior)
CREATE POLICY "Inquiries: authenticated read"
  ON public.event_inquiries FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can update inquiries (matches current edit-from-app flow)
CREATE POLICY "Inquiries: authenticated update"
  ON public.event_inquiries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only admins can insert manually or delete
CREATE POLICY "Inquiries: admin insert"
  ON public.event_inquiries FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Inquiries: admin delete"
  ON public.event_inquiries FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Reuse existing set_updated_at trigger
CREATE TRIGGER event_inquiries_set_updated_at
  BEFORE UPDATE ON public.event_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();