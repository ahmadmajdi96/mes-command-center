-- 1. Tracking mode --------------------------------------------------------

ALTER TABLE public.lines
  ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'serial',
  ADD COLUMN IF NOT EXISTS enforce_route boolean NOT NULL DEFAULT true;
ALTER TABLE public.lines DROP CONSTRAINT IF EXISTS lines_tracking_mode_check;
ALTER TABLE public.lines ADD CONSTRAINT lines_tracking_mode_check
  CHECK (tracking_mode IN ('serial','lot'));

ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'serial',
  ADD COLUMN IF NOT EXISTS qty_good numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_rework numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_scrap numeric NOT NULL DEFAULT 0;
ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_tracking_mode_check;
ALTER TABLE public.production_orders ADD CONSTRAINT production_orders_tracking_mode_check
  CHECK (tracking_mode IN ('serial','lot'));

ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'serial',
  ADD COLUMN IF NOT EXISTS qty_good numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_rework numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_scrap numeric NOT NULL DEFAULT 0;
ALTER TABLE public.production_batches DROP CONSTRAINT IF EXISTS production_batches_tracking_mode_check;
ALTER TABLE public.production_batches ADD CONSTRAINT production_batches_tracking_mode_check
  CHECK (tracking_mode IN ('serial','lot'));

-- 2. Recipe / step rules --------------------------------------------------

ALTER TABLE public.product_station_recipes
  ADD COLUMN IF NOT EXISTS is_ccp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocks_on_fail boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_reading boolean NOT NULL DEFAULT false;

-- 3. Lot progress per batch/station --------------------------------------

CREATE TABLE IF NOT EXISTS public.batch_station_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id) ON DELETE RESTRICT,
  batch_id text NOT NULL REFERENCES public.production_batches(id) ON DELETE RESTRICT,
  production_order_id text,
  station_id text REFERENCES public.stations(id) ON DELETE RESTRICT,
  station_name text,
  line_id text,
  qty_in numeric NOT NULL DEFAULT 0,
  qty_good numeric NOT NULL DEFAULT 0,
  qty_rework numeric NOT NULL DEFAULT 0,
  qty_scrap numeric NOT NULL DEFAULT 0,
  scrap_reason_code text,
  notes text,
  operator_id text,
  operator_name text,
  actor_user_id uuid,
  device_id text,
  correlation_id text,
  corrects_progress_id uuid REFERENCES public.batch_station_progress(id),
  correction_reason text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.batch_station_progress TO authenticated;
GRANT ALL ON public.batch_station_progress TO service_role;

ALTER TABLE public.batch_station_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read lot progress with report access"
  ON public.batch_station_progress FOR SELECT TO authenticated
  USING (public.has_action(auth.uid(), 'reports.read') OR public.has_action(auth.uid(), 'execution.record'));

CREATE POLICY "Record lot progress with execution access"
  ON public.batch_station_progress FOR INSERT TO authenticated
  WITH CHECK (public.has_action(auth.uid(), 'execution.record'));

CREATE POLICY "batch_station_progress_tenant_isolation"
  ON public.batch_station_progress AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.in_my_org(organization_id))
  WITH CHECK (public.in_my_org(organization_id));

-- Lot progress is production history: append-only.
DROP TRIGGER IF EXISTS batch_station_progress_append_only ON public.batch_station_progress;
CREATE TRIGGER batch_station_progress_append_only
  BEFORE UPDATE OR DELETE ON public.batch_station_progress
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

CREATE INDEX IF NOT EXISTS idx_bsp_batch ON public.batch_station_progress (batch_id);
CREATE INDEX IF NOT EXISTS idx_bsp_station ON public.batch_station_progress (station_id);

-- 4. Lifecycle transitions ------------------------------------------------

CREATE OR REPLACE FUNCTION public.assert_status_transition(_entity text, _from text, _to text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE allowed text[];
BEGIN
  IF _from IS NULL OR _to IS NULL OR _from = _to THEN RETURN; END IF;
  allowed := CASE _from
    WHEN 'planned'   THEN ARRAY['released','cancelled']
    WHEN 'scheduled' THEN ARRAY['planned','released','cancelled']
    WHEN 'released'  THEN ARRAY['planned','running','cancelled']
    WHEN 'running'   THEN ARRAY['paused','finished','cancelled']
    WHEN 'paused'    THEN ARRAY['running','cancelled']
    WHEN 'finished'  THEN ARRAY['closed']
    WHEN 'closed'    THEN ARRAY[]::text[]
    WHEN 'cancelled' THEN ARRAY[]::text[]
    ELSE NULL
  END;
  IF allowed IS NULL THEN RETURN; END IF;
  IF NOT (_to = ANY(allowed)) THEN
    RAISE EXCEPTION 'A % cannot go from % to %. Allowed next steps: %',
      _entity, _from, _to,
      CASE WHEN array_length(allowed,1) IS NULL THEN 'none' ELSE array_to_string(allowed, ', ') END;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_order_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.assert_status_transition('production order', OLD.status, NEW.status);
    IF NEW.status IN ('finished','closed') AND EXISTS (
      SELECT 1 FROM public.production_batches b
      WHERE b.production_order_id = NEW.id
        AND b.status NOT IN ('finished','closed','cancelled')
    ) THEN
      RAISE EXCEPTION 'This order still has batches that are not finished or cancelled';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_batch_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.assert_status_transition('batch', OLD.status, NEW.status);
    IF NEW.status IN ('finished','closed') THEN
      IF EXISTS (
        SELECT 1 FROM public.unit_events e
        JOIN public.product_units u ON u.uid = e.unit_uid
        WHERE u.batch_id = NEW.id AND e.exited_at IS NULL AND e.entered_at IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Some items of this batch are still open at a station';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.product_units u
        WHERE u.batch_id = NEW.id AND u.status IN ('in_process','created')
      ) THEN
        RAISE EXCEPTION 'Some items of this batch have not been completed, scrapped or rejected yet';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS production_orders_lifecycle ON public.production_orders;
CREATE TRIGGER production_orders_lifecycle BEFORE UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_lifecycle();

DROP TRIGGER IF EXISTS production_batches_lifecycle ON public.production_batches;
CREATE TRIGGER production_batches_lifecycle BEFORE UPDATE ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.guard_batch_lifecycle();

-- 5. Yield reconciliation -------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalc_batch_and_order_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  b text;
  o text;
BEGIN
  FOREACH b IN ARRAY ARRAY[NEW.batch_id, OLD.batch_id] LOOP
    IF b IS NOT NULL THEN
      UPDATE public.production_batches pb SET
        qty_good = (SELECT count(*) FROM public.product_units u WHERE u.batch_id = b AND u.status = 'completed')
                 + COALESCE((SELECT sum(p.qty_good) FROM public.batch_station_progress p WHERE p.batch_id = b), 0),
        qty_scrap = (SELECT count(*) FROM public.product_units u WHERE u.batch_id = b AND u.status IN ('scrapped','rejected'))
                 + COALESCE((SELECT sum(p.qty_scrap) FROM public.batch_station_progress p WHERE p.batch_id = b), 0),
        qty_rework = (SELECT count(*) FROM public.product_units u WHERE u.batch_id = b AND u.status = 'rework')
                 + COALESCE((SELECT sum(p.qty_rework) FROM public.batch_station_progress p WHERE p.batch_id = b), 0),
        qty_produced = (SELECT count(*) FROM public.product_units u WHERE u.batch_id = b AND u.status = 'completed')
                 + COALESCE((SELECT sum(p.qty_good) FROM public.batch_station_progress p WHERE p.batch_id = b), 0)
      WHERE pb.id = b;
    END IF;
  END LOOP;

  FOREACH o IN ARRAY ARRAY[NEW.production_order_id, OLD.production_order_id] LOOP
    IF o IS NOT NULL THEN
      UPDATE public.production_orders po SET
        qty_good = COALESCE((SELECT sum(pb.qty_good) FROM public.production_batches pb WHERE pb.production_order_id = o), 0),
        qty_scrap = COALESCE((SELECT sum(pb.qty_scrap) FROM public.production_batches pb WHERE pb.production_order_id = o), 0),
        qty_rework = COALESCE((SELECT sum(pb.qty_rework) FROM public.production_batches pb WHERE pb.production_order_id = o), 0),
        qty_produced = COALESCE((SELECT sum(pb.qty_produced) FROM public.production_batches pb WHERE pb.production_order_id = o), 0)
      WHERE po.id = o;
    END IF;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_from_lot_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE o text;
BEGIN
  UPDATE public.production_batches pb SET
    qty_good = (SELECT count(*) FROM public.product_units u WHERE u.batch_id = NEW.batch_id AND u.status = 'completed')
             + COALESCE((SELECT sum(p.qty_good) FROM public.batch_station_progress p WHERE p.batch_id = NEW.batch_id), 0),
    qty_scrap = (SELECT count(*) FROM public.product_units u WHERE u.batch_id = NEW.batch_id AND u.status IN ('scrapped','rejected'))
             + COALESCE((SELECT sum(p.qty_scrap) FROM public.batch_station_progress p WHERE p.batch_id = NEW.batch_id), 0),
    qty_rework = COALESCE((SELECT sum(p.qty_rework) FROM public.batch_station_progress p WHERE p.batch_id = NEW.batch_id), 0),
    qty_produced = (SELECT count(*) FROM public.product_units u WHERE u.batch_id = NEW.batch_id AND u.status = 'completed')
             + COALESCE((SELECT sum(p.qty_good) FROM public.batch_station_progress p WHERE p.batch_id = NEW.batch_id), 0)
  WHERE pb.id = NEW.batch_id
  RETURNING pb.production_order_id INTO o;

  IF o IS NOT NULL THEN
    UPDATE public.production_orders po SET
      qty_good = COALESCE((SELECT sum(pb.qty_good) FROM public.production_batches pb WHERE pb.production_order_id = o), 0),
      qty_scrap = COALESCE((SELECT sum(pb.qty_scrap) FROM public.production_batches pb WHERE pb.production_order_id = o), 0),
      qty_rework = COALESCE((SELECT sum(pb.qty_rework) FROM public.production_batches pb WHERE pb.production_order_id = o), 0),
      qty_produced = COALESCE((SELECT sum(pb.qty_produced) FROM public.production_batches pb WHERE pb.production_order_id = o), 0)
    WHERE po.id = o;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lot_progress_rollup ON public.batch_station_progress;
CREATE TRIGGER trg_lot_progress_rollup AFTER INSERT ON public.batch_station_progress
  FOR EACH ROW EXECUTE FUNCTION public.recalc_from_lot_progress();

-- 6. New permissions -----------------------------------------------------

INSERT INTO public.permissions (key, description) VALUES
  ('execution.rework', 'Send a rejected item back into the route for rework'),
  ('orders.lifecycle', 'Release, start, pause, finish, close or cancel orders and batches'),
  ('machines.command', 'Send start, stop and setpoint commands to machines')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.key, p.key
FROM public.roles r
CROSS JOIN (VALUES ('execution.rework'), ('orders.lifecycle'), ('machines.command')) AS p(key)
WHERE (r.key IN ('supervisor','plant_manager','platform_admin'))
   OR (r.key IN ('planner') AND p.key = 'orders.lifecycle')
   OR (r.key IN ('process_engineer') AND p.key IN ('execution.rework','machines.command'))
ON CONFLICT DO NOTHING;