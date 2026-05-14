
ALTER TABLE public.allowed_emails
  ADD COLUMN IF NOT EXISTS as_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_first_user BOOLEAN;
  invited_as_admin BOOLEAN;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM auth.users WHERE id <> NEW.id) INTO is_first_user;

  IF NOT is_first_user AND NOT public.is_email_allowed(NEW.email) THEN
    RAISE EXCEPTION 'Email % is not on the invite list. Ask an admin to add you.', NEW.email
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));

  SELECT COALESCE(bool_or(as_admin), false) INTO invited_as_admin
    FROM public.allowed_emails
    WHERE lower(email) = lower(NEW.email);

  IF is_first_user OR invited_as_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;

  RETURN NEW;
END;
$function$;
