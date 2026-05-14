ALTER TABLE public.event_inquiries
  ADD COLUMN food_restrictions text NOT NULL DEFAULT '',
  ADD COLUMN premium_drinks text NOT NULL DEFAULT '',
  ADD COLUMN premium_drinks_details text NOT NULL DEFAULT '',
  ADD COLUMN wedding_sections text NOT NULL DEFAULT '',
  ADD COLUMN referral_source text NOT NULL DEFAULT '';