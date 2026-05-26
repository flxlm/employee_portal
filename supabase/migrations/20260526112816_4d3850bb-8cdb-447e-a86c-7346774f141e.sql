
-- 1. Announcements: restrict UPDATE/INSERT/DELETE to admins
DROP POLICY IF EXISTS "Announcements: auth update" ON public.announcements;
CREATE POLICY "Announcements: admin update"
  ON public.announcements FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Announcements: admin insert"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Announcements: admin delete"
  ON public.announcements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. open_close_logs: SELECT own + admin
DROP POLICY IF EXISTS "Logs: authenticated read" ON public.open_close_logs;
CREATE POLICY "Logs: own or admin read"
  ON public.open_close_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 3. Storage: shift-photos
DROP POLICY IF EXISTS "Shift photos: authenticated read" ON storage.objects;
CREATE POLICY "Shift photos: own folder or admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'shift-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
CREATE POLICY "Shift photos: own folder or admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'shift-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
CREATE POLICY "Shift photos: own folder or admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'shift-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- 4. Make menu_display_view use invoker's permissions (not definer's)
ALTER VIEW public.menu_display_view SET (security_invoker = true);

-- 5. Revoke EXECUTE from anon/public on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_email_allowed(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_email_allowed(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.inventory_items_log_quantity() FROM anon, authenticated, public;
