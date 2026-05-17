-- Bilingual translation columns for menu tables

-- menu_items: title + description
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_source_lang text NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS title_translated_from text,
  ADD COLUMN IF NOT EXISTS title_is_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_source_lang text NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS description_translated_from text,
  ADD COLUMN IF NOT EXISTS description_is_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_translate boolean NOT NULL DEFAULT false;

ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_title_source_lang_check,
  ADD CONSTRAINT menu_items_title_source_lang_check CHECK (title_source_lang IN ('fr','en')),
  DROP CONSTRAINT IF EXISTS menu_items_description_source_lang_check,
  ADD CONSTRAINT menu_items_description_source_lang_check CHECK (description_source_lang IN ('fr','en'));

-- menu_subsections: name + description
ALTER TABLE public.menu_subsections
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_source_lang text NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS name_translated_from text,
  ADD COLUMN IF NOT EXISTS name_is_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_source_lang text NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS description_translated_from text,
  ADD COLUMN IF NOT EXISTS description_is_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_translate boolean NOT NULL DEFAULT false;

ALTER TABLE public.menu_subsections
  DROP CONSTRAINT IF EXISTS menu_subsections_name_source_lang_check,
  ADD CONSTRAINT menu_subsections_name_source_lang_check CHECK (name_source_lang IN ('fr','en')),
  DROP CONSTRAINT IF EXISTS menu_subsections_description_source_lang_check,
  ADD CONSTRAINT menu_subsections_description_source_lang_check CHECK (description_source_lang IN ('fr','en'));

-- menu_sections: name + description
ALTER TABLE public.menu_sections
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_source_lang text NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS name_translated_from text,
  ADD COLUMN IF NOT EXISTS name_is_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_source_lang text NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS description_translated_from text,
  ADD COLUMN IF NOT EXISTS description_is_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_translate boolean NOT NULL DEFAULT false;

ALTER TABLE public.menu_sections
  DROP CONSTRAINT IF EXISTS menu_sections_name_source_lang_check,
  ADD CONSTRAINT menu_sections_name_source_lang_check CHECK (name_source_lang IN ('fr','en')),
  DROP CONSTRAINT IF EXISTS menu_sections_description_source_lang_check,
  ADD CONSTRAINT menu_sections_description_source_lang_check CHECK (description_source_lang IN ('fr','en'));