
-- Roles enum and table (separate from profiles for security)
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allowed emails (invite-only signup)
CREATE TABLE public.allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Open / Close logs
CREATE TYPE public.shift_type AS ENUM ('open', 'close');

CREATE TABLE public.open_close_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  shift_type shift_type NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  till_amount NUMERIC(10,2) NOT NULL,
  till_status TEXT NOT NULL, -- 'over' / 'under' / 'exact'
  till_difference NUMERIC(10,2) NOT NULL DEFAULT 0,
  photo_path TEXT,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.open_close_logs ENABLE ROW LEVEL SECURITY;

-- Security definer role check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Email allowlist check
CREATE OR REPLACE FUNCTION public.is_email_allowed(_email TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.allowed_emails WHERE lower(email) = lower(_email))
$$;

-- Auto-create profile and gate signup on allowlist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM auth.users WHERE id <> NEW.id) INTO is_first_user;

  IF NOT is_first_user AND NOT public.is_email_allowed(NEW.email) THEN
    RAISE EXCEPTION 'Email % is not on the invite list. Ask an admin to add you.', NEW.email
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));

  -- First user becomes admin; everyone else becomes employee
  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS policies
-- profiles
CREATE POLICY "Profiles: read own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: update own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- user_roles
CREATE POLICY "Roles: read own or admin" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- allowed_emails (admin only)
CREATE POLICY "Allowed emails: admin read" ON public.allowed_emails
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Allowed emails: admin manage" ON public.allowed_emails
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- open_close_logs: any employee can read all, only owner can insert their own; admin can delete
CREATE POLICY "Logs: authenticated read" ON public.open_close_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Logs: insert own" ON public.open_close_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Logs: admin delete" ON public.open_close_logs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for shift photos (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('shift-photos', 'shift-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Shift photos: authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shift-photos');

CREATE POLICY "Shift photos: user upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shift-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
