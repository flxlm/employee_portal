
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.passcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  code text NOT NULL,
  admin_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.passcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passcodes: read non-admin or admin reads all"
  ON public.passcodes FOR SELECT
  TO authenticated
  USING (admin_only = false OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Passcodes: admin manage"
  ON public.passcodes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER passcodes_set_updated_at
  BEFORE UPDATE ON public.passcodes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
