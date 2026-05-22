CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT false,
  message text NOT NULL DEFAULT '',
  link_url text,
  link_text text,
  background_color text NOT NULL DEFAULT '#000000',
  text_color text NOT NULL DEFAULT '#FFFFFF',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Announcements: auth read"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Announcements: auth update"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO public.announcements (is_enabled, message) VALUES (false, '');