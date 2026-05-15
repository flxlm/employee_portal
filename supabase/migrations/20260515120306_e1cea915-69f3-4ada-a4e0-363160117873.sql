ALTER VIEW public.menu_display_view SET (security_invoker = true);
-- Allow anon to read menu data through the view
CREATE POLICY "Menu sections: anon read" ON public.menu_sections FOR SELECT TO anon USING (is_deleted = false);
CREATE POLICY "Menu subsections: anon read" ON public.menu_subsections FOR SELECT TO anon USING (is_deleted = false);
CREATE POLICY "Menu items: anon read" ON public.menu_items FOR SELECT TO anon USING (is_deleted = false);
CREATE POLICY "Item mods: anon read" ON public.item_modifications FOR SELECT TO anon USING (is_deleted = false);
