ALTER TABLE public.menu_sections ADD COLUMN IF NOT EXISTS sold_out_date date;
ALTER TABLE public.menu_subsections ADD COLUMN IF NOT EXISTS sold_out_date date;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS sold_out_date date;