
CREATE TABLE public.inventory_item_suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  supplier text NOT NULL DEFAULT '',
  cost numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_item_suppliers_item ON public.inventory_item_suppliers(item_id);

ALTER TABLE public.inventory_item_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inv item suppliers: auth read"
  ON public.inventory_item_suppliers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Inv item suppliers: auth insert"
  ON public.inventory_item_suppliers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Inv item suppliers: auth update"
  ON public.inventory_item_suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Inv item suppliers: admin delete"
  ON public.inventory_item_suppliers FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER inv_item_suppliers_set_updated_at
  BEFORE UPDATE ON public.inventory_item_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
