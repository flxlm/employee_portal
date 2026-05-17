
-- Categories
CREATE TABLE public.inventory_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inv cats: auth read" ON public.inventory_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inv cats: auth insert" ON public.inventory_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Inv cats: auth update" ON public.inventory_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Inv cats: admin delete" ON public.inventory_categories FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.inventory_categories (name, display_order) VALUES
  ('Food Ingredients', 1),
  ('Drink Ingredients', 2),
  ('Coffee Beans', 3),
  ('Supplies', 4);

-- Items
CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.inventory_categories(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  current_quantity numeric NOT NULL DEFAULT 0,
  par_level numeric NOT NULL DEFAULT 0,
  reorder_threshold numeric NOT NULL DEFAULT 0,
  last_supplier text,
  notes text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX inventory_items_category_idx ON public.inventory_items(category_id);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inv items: auth read" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inv items: auth insert" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Inv items: auth update" ON public.inventory_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Inv items: admin delete" ON public.inventory_items FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- History
CREATE TABLE public.inventory_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  old_quantity numeric NOT NULL,
  new_quantity numeric NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_history_item_idx ON public.inventory_history(item_id);
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inv history: auth read" ON public.inventory_history FOR SELECT TO authenticated USING (true);

-- Trigger to capture quantity changes
CREATE OR REPLACE FUNCTION public.inventory_items_log_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_quantity IS DISTINCT FROM OLD.current_quantity THEN
    INSERT INTO public.inventory_history (item_id, old_quantity, new_quantity, changed_by)
    VALUES (NEW.id, OLD.current_quantity, NEW.current_quantity, NEW.updated_by);
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_items_quantity_trigger
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.inventory_items_log_quantity();

-- Order request status
CREATE TYPE public.order_request_status AS ENUM ('pending', 'ordered', 'cancelled');

CREATE TABLE public.order_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  ad_hoc_name text,
  quantity_needed numeric,
  unit text,
  notes text,
  supplier text,
  flagged_by uuid,
  flagged_at timestamptz NOT NULL DEFAULT now(),
  status public.order_request_status NOT NULL DEFAULT 'pending',
  ordered_by uuid,
  ordered_at timestamptz
);
CREATE INDEX order_requests_status_idx ON public.order_requests(status);
CREATE INDEX order_requests_item_idx ON public.order_requests(inventory_item_id);
ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order req: auth read" ON public.order_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Order req: auth insert" ON public.order_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Order req: auth update" ON public.order_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Order req: admin delete" ON public.order_requests FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_categories;
