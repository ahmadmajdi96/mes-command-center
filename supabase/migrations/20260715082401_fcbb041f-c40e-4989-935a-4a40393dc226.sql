
-- 1) Batches table
CREATE TABLE public.production_batches (
  id text PRIMARY KEY,
  production_order_id text NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  number text NOT NULL UNIQUE,
  lot_number text NOT NULL UNIQUE,
  sequence integer NOT NULL DEFAULT 1,
  sku text NOT NULL,
  product_name text NOT NULL,
  product_id text,
  qty numeric NOT NULL DEFAULT 0,
  qty_produced numeric NOT NULL DEFAULT 0,
  uom text NOT NULL DEFAULT 'ea',
  status text NOT NULL DEFAULT 'scheduled',
  line_id text,
  planned_start timestamptz,
  planned_end timestamptz,
  priority text NOT NULL DEFAULT 'normal',
  shift text NOT NULL DEFAULT 'A',
  operator text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_batches TO anon;
GRANT ALL ON public.production_batches TO service_role;

ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can manage batches (demo)" ON public.production_batches FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_prod_batches_updated
  BEFORE UPDATE ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Link units to batches
ALTER TABLE public.product_units
  ADD COLUMN IF NOT EXISTS batch_id text REFERENCES public.production_batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS product_units_batch_id_idx ON public.product_units(batch_id);

ALTER TABLE public.unit_events
  ADD COLUMN IF NOT EXISTS batch_id text,
  ADD COLUMN IF NOT EXISTS entered_at timestamptz,
  ADD COLUMN IF NOT EXISTS exited_at timestamptz,
  ADD COLUMN IF NOT EXISTS dwell_seconds integer;

CREATE INDEX IF NOT EXISTS unit_events_open_at_station_idx
  ON public.unit_events(station_id, unit_uid) WHERE exited_at IS NULL;

-- 3) Progress rollup: recompute batch and order qty_produced on unit completion
CREATE OR REPLACE FUNCTION public.recalc_batch_and_order_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_batch_id text;
  v_order_id text;
BEGIN
  v_batch_id := COALESCE(NEW.batch_id, OLD.batch_id);
  v_order_id := COALESCE(NEW.production_order_id, OLD.production_order_id);

  IF v_batch_id IS NOT NULL THEN
    UPDATE public.production_batches b
    SET qty_produced = (
      SELECT count(*) FROM public.product_units u
      WHERE u.batch_id = v_batch_id AND u.status = 'completed'
    )
    WHERE b.id = v_batch_id;
  END IF;

  IF v_order_id IS NOT NULL THEN
    UPDATE public.production_orders o
    SET qty_produced = (
      SELECT count(*) FROM public.product_units u
      WHERE u.production_order_id = v_order_id AND u.status = 'completed'
    )
    WHERE o.id = v_order_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_units_progress ON public.product_units;
CREATE TRIGGER trg_units_progress
  AFTER INSERT OR UPDATE OF status, batch_id ON public.product_units
  FOR EACH ROW EXECUTE FUNCTION public.recalc_batch_and_order_progress();

-- 4) Realtime for batches
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_batches;
