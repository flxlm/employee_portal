ALTER TABLE public.daily_messages
  ADD COLUMN IF NOT EXISTS visible_from timestamp with time zone NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS daily_messages_visible_from_idx
  ON public.daily_messages (visible_from);

DROP POLICY IF EXISTS "Daily messages: auth read non-expired" ON public.daily_messages;

CREATE POLICY "Daily messages: auth read visible"
  ON public.daily_messages
  FOR SELECT
  TO authenticated
  USING (expires_at > now() AND visible_from <= now());
