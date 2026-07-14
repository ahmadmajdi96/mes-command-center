
-- =========================================================================
-- Products, Production Orders (lot-numbered), Product Units (UID trace)
-- =========================================================================

CREATE TABLE public.products (
  id text PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'finished',
  uom text NOT NULL DEFAULT 'ea',
  standard_cost numeric NOT NULL DEFAULT 0,
  sale_price numeric NOT NULL DEFAULT 0,
  lead_time integer NOT NULL DEFAULT 0,
  batching_limit integer NOT NULL DEFAULT 0,
  specifications jsonb,
  acceptance_criteria jsonb,
  attachments jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public products all" ON public.products FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.production_orders (
  id text PRIMARY KEY,
  number text NOT NULL UNIQUE,
  lot_number text NOT NULL,
  product_id text REFERENCES public.products(id) ON DELETE SET NULL,
  sku text NOT NULL,
  product_name text NOT NULL,
  qty numeric NOT NULL DEFAULT 0,
  qty_produced numeric NOT NULL DEFAULT 0,
  uom text NOT NULL DEFAULT 'ea',
  line_id text,
  planned_start timestamptz,
  planned_end timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  priority text NOT NULL DEFAULT 'normal',
  operator text,
  shift text NOT NULL DEFAULT 'A',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_orders TO anon, authenticated;
GRANT ALL ON public.production_orders TO service_role;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public production_orders all" ON public.production_orders FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX prod_orders_line_start ON public.production_orders(line_id, planned_start);
CREATE INDEX prod_orders_lot ON public.production_orders(lot_number);

CREATE TABLE public.product_units (
  uid text PRIMARY KEY,
  serial integer NOT NULL,
  lot_number text NOT NULL,
  production_order_id text REFERENCES public.production_orders(id) ON DELETE CASCADE,
  product_id text,
  sku text NOT NULL,
  product_name text NOT NULL,
  current_station_id text,
  current_line_id text,
  status text NOT NULL DEFAULT 'created',
  produced_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_units TO anon, authenticated;
GRANT ALL ON public.product_units TO service_role;
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public product_units all" ON public.product_units FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX product_units_po ON public.product_units(production_order_id);
CREATE INDEX product_units_lot ON public.product_units(lot_number);
CREATE INDEX product_units_current_station ON public.product_units(current_station_id);

CREATE TABLE public.unit_events (
  id text PRIMARY KEY,
  unit_uid text NOT NULL REFERENCES public.product_units(uid) ON DELETE CASCADE,
  station_id text,
  station_name text,
  line_id text,
  event text NOT NULL,
  result text,
  operator_id text,
  operator_name text,
  at timestamptz NOT NULL DEFAULT now(),
  notes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_events TO anon, authenticated;
GRANT ALL ON public.unit_events TO service_role;
ALTER TABLE public.unit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public unit_events all" ON public.unit_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX unit_events_uid ON public.unit_events(unit_uid, at DESC);
CREATE INDEX unit_events_station ON public.unit_events(station_id, at DESC);

-- Update triggers
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER production_orders_updated BEFORE UPDATE ON public.production_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_units_updated BEFORE UPDATE ON public.product_units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.production_orders REPLICA IDENTITY FULL;
ALTER TABLE public.product_units REPLICA IDENTITY FULL;
ALTER TABLE public.unit_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_units;
ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_events;

-- Seed a starter product catalog mirroring the sibling app's product shape
INSERT INTO public.products (id, sku, name, description, type, uom, standard_cost, sale_price, lead_time) VALUES
  ('P-001','GRA-060','Granola Bar 60g','Oat & honey granola bar','finished','ea',0.42,1.20,7),
  ('P-002','SDL-500','Sourdough Loaf 500g','Artisan sourdough','finished','ea',0.85,2.50,3),
  ('P-003','CPJ-330','Cold-Press Juice 330ml','Orange cold-press','finished','btl',0.60,2.00,2),
  ('P-004','HAL-200','Halloumi 200g','Traditional halloumi','finished','ea',1.10,3.20,5),
  ('P-005','OAT-BULK','Rolled Oats (bulk)','Raw oats','raw','kg',0.90,0,14),
  ('P-006','FLR-T55','Wheat Flour T55','Bread flour','raw','kg',0.55,0,10)
ON CONFLICT (id) DO NOTHING;
