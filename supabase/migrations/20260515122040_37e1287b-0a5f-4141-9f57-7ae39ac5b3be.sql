ALTER TABLE public.menu_sections
  ADD COLUMN visible_menus text[] NOT NULL DEFAULT ARRAY['breakfast','lunch','dinner']::text[];

ALTER TABLE public.menu_subsections
  ADD COLUMN visible_menus text[] NOT NULL DEFAULT ARRAY['breakfast','lunch','dinner']::text[];