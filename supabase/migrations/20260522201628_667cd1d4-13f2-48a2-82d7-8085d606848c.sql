CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.estimate_email_drafts (
  event_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('english','french')),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, language)
);

ALTER TABLE public.estimate_email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read drafts"
ON public.estimate_email_drafts FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated can insert drafts"
ON public.estimate_email_drafts FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update drafts"
ON public.estimate_email_drafts FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_estimate_email_drafts_updated_at
BEFORE UPDATE ON public.estimate_email_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();