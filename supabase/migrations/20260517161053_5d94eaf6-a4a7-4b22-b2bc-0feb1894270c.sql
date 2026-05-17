CREATE TABLE public.daily_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  created_by uuid,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily messages: auth read non-expired"
  ON public.daily_messages FOR SELECT
  TO authenticated
  USING (expires_at > now());

CREATE POLICY "Daily messages: admin read all"
  ON public.daily_messages FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Daily messages: admin insert"
  ON public.daily_messages FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Daily messages: admin update"
  ON public.daily_messages FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Daily messages: admin delete"
  ON public.daily_messages FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER daily_messages_set_updated_at
  BEFORE UPDATE ON public.daily_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_daily_messages_expires_at ON public.daily_messages(expires_at);