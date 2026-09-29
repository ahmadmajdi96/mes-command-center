
-- ===== WIP =====
CREATE TABLE public.wip_locations (
  id text PRIMARY KEY, organization_id text NOT NULL, name text NOT NULL,
  kind text NOT NULL DEFAULT 'buffer' CHECK (kind IN ('buffer','staging','quarantine','warehouse','line_side')),
  line_id text, aging_limit_hours numeric NOT NULL DEFAULT 24, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wip_locations TO authenticated; GRANT ALL ON public.wip_locations TO service_role;
ALTER TABLE public.wip_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.wip_locations FOR SELECT TO authenticated USING (in_my_org(organization_id));
CREATE POLICY "org write" ON public.wip_locations FOR ALL TO authenticated USING (in_my_org(organization_id) AND has_action(auth.uid(),'masterdata.write')) WITH CHECK (in_my_org(organization_id) AND has_action(auth.uid(),'masterdata.write'));
CREATE TRIGGER wip_locations_updated BEFORE UPDATE ON public.wip_locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.production_batches ADD COLUMN location_id text REFERENCES public.wip_locations(id),
  ADD COLUMN located_at timestamptz, ADD COLUMN parent_batch_id text, ADD COLUMN merged_into text;

CREATE TABLE public.batch_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  link_type text NOT NULL CHECK (link_type IN ('split','merge')), parent_batch_id text NOT NULL, child_batch_id text NOT NULL,
  qty numeric NOT NULL, reason text, actor_user_id uuid, actor_name text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.batch_links TO authenticated; GRANT ALL ON public.batch_links TO service_role;
ALTER TABLE public.batch_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.batch_links FOR SELECT TO authenticated USING (in_my_org(organization_id));
CREATE TRIGGER batch_links_append_only BEFORE UPDATE OR DELETE ON public.batch_links FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

CREATE TABLE public.wip_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, batch_id text NOT NULL,
  from_location_id text, to_location_id text NOT NULL, qty numeric, reason text,
  actor_user_id uuid, actor_name text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.wip_moves TO authenticated; GRANT ALL ON public.wip_moves TO service_role;
ALTER TABLE public.wip_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.wip_moves FOR SELECT TO authenticated USING (in_my_org(organization_id));
CREATE TRIGGER wip_moves_append_only BEFORE UPDATE OR DELETE ON public.wip_moves FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

CREATE TABLE public.wip_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, location_id text NOT NULL, batch_id text NOT NULL,
  expected_qty numeric NOT NULL, counted_qty numeric NOT NULL, variance numeric GENERATED ALWAYS AS (counted_qty - expected_qty) STORED,
  reason text, actor_user_id uuid, actor_name text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.wip_counts TO authenticated; GRANT ALL ON public.wip_counts TO service_role;
ALTER TABLE public.wip_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.wip_counts FOR SELECT TO authenticated USING (in_my_org(organization_id));
CREATE POLICY "org insert" ON public.wip_counts FOR INSERT TO authenticated WITH CHECK (in_my_org(organization_id) AND (has_action(auth.uid(),'material.handle') OR has_action(auth.uid(),'execution.record')));
CREATE TRIGGER wip_counts_append_only BEFORE UPDATE OR DELETE ON public.wip_counts FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE OR REPLACE FUNCTION public.guard_wip_count() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.counted_qty < 0 THEN RAISE EXCEPTION 'Counted quantity cannot be negative'; END IF;
  IF NEW.counted_qty <> NEW.expected_qty AND coalesce(trim(NEW.reason),'') = '' THEN RAISE EXCEPTION 'A count that differs from the expected quantity needs a reason'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wip_counts_guard BEFORE INSERT ON public.wip_counts FOR EACH ROW EXECUTE FUNCTION guard_wip_count();

CREATE OR REPLACE FUNCTION public.actor_name() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT coalesce(full_name, email) FROM profiles WHERE id = auth.uid()), 'System') $$;

CREATE OR REPLACE FUNCTION public.move_batch(_batch_id text, _to text, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b record; loc record;
BEGIN
  SELECT * INTO b FROM production_batches WHERE id = _batch_id;
  IF NOT FOUND OR NOT in_my_org(b.organization_id) THEN RAISE EXCEPTION 'Batch not found'; END IF;
  IF NOT (has_action(auth.uid(),'execution.record') OR has_action(auth.uid(),'material.handle')) THEN RAISE EXCEPTION 'You do not have permission to move WIP'; END IF;
  SELECT * INTO loc FROM wip_locations WHERE id = _to AND organization_id = b.organization_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Location not found or inactive'; END IF;
  IF b.status IN ('completed','closed','cancelled') THEN RAISE EXCEPTION 'A % batch is no longer WIP', b.status; END IF;
  IF b.location_id = _to THEN RAISE EXCEPTION 'The batch is already at %', loc.name; END IF;
  INSERT INTO wip_moves (organization_id, batch_id, from_location_id, to_location_id, qty, reason, actor_user_id, actor_name)
  VALUES (b.organization_id, b.id, b.location_id, _to, b.qty - b.qty_produced - b.qty_scrap, _reason, auth.uid(), actor_name());
  UPDATE production_batches SET location_id = _to, located_at = now() WHERE id = b.id;
END $$;

CREATE OR REPLACE FUNCTION public.split_batch(_batch_id text, _qty numeric, _reason text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b record; n int; nid text; free numeric;
BEGIN
  SELECT * INTO b FROM production_batches WHERE id = _batch_id FOR UPDATE;
  IF NOT FOUND OR NOT in_my_org(b.organization_id) THEN RAISE EXCEPTION 'Batch not found'; END IF;
  IF NOT (has_action(auth.uid(),'orders.lifecycle') OR has_action(auth.uid(),'execution.override')) THEN RAISE EXCEPTION 'You do not have permission to split batches'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'A split needs a reason'; END IF;
  IF b.status IN ('completed','closed','cancelled') THEN RAISE EXCEPTION 'A % batch cannot be split', b.status; END IF;
  free := b.qty - b.qty_produced - b.qty_scrap;
  IF _qty IS NULL OR _qty <= 0 OR _qty >= free THEN RAISE EXCEPTION 'Split quantity must be above 0 and below the unprocessed quantity (%)', free; END IF;
  SELECT count(*) + 1 INTO n FROM production_batches WHERE parent_batch_id = b.id;
  nid := b.id || '-S' || n;
  INSERT INTO production_batches (id, production_order_id, number, lot_number, sequence, sku, product_name, product_id, qty, uom, status, line_id, planned_start, planned_end, priority, shift, notes, organization_id, tracking_mode, location_id, located_at, parent_batch_id)
  VALUES (nid, b.production_order_id, b.number || '-S' || n, b.lot_number || '-S' || n, b.sequence * 100 + n, b.sku, b.product_name, b.product_id, _qty, b.uom,
          CASE WHEN b.status IN ('running','paused') THEN 'released' ELSE b.status END, b.line_id, b.planned_start, b.planned_end, b.priority, b.shift, 'Split from ' || b.number || ': ' || _reason, b.organization_id, b.tracking_mode, b.location_id, now(), b.id);
  UPDATE production_batches SET qty = qty - _qty WHERE id = b.id;
  INSERT INTO batch_links (organization_id, link_type, parent_batch_id, child_batch_id, qty, reason, actor_user_id, actor_name)
  VALUES (b.organization_id, 'split', b.id, nid, _qty, _reason, auth.uid(), actor_name());
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.merge_batches(_target text, _sources text[], _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t record; s record; sid text;
BEGIN
  SELECT * INTO t FROM production_batches WHERE id = _target FOR UPDATE;
  IF NOT FOUND OR NOT in_my_org(t.organization_id) THEN RAISE EXCEPTION 'Target batch not found'; END IF;
  IF NOT (has_action(auth.uid(),'orders.lifecycle') OR has_action(auth.uid(),'execution.override')) THEN RAISE EXCEPTION 'You do not have permission to merge batches'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'A merge needs a reason'; END IF;
  IF array_length(_sources,1) IS NULL THEN RAISE EXCEPTION 'Choose at least one batch to merge in'; END IF;
  IF t.status IN ('completed','closed','cancelled') THEN RAISE EXCEPTION 'Cannot merge into a % batch', t.status; END IF;
  FOREACH sid IN ARRAY _sources LOOP
    IF sid = _target THEN RAISE EXCEPTION 'A batch cannot be merged into itself'; END IF;
    SELECT * INTO s FROM production_batches WHERE id = sid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Batch % not found', sid; END IF;
    IF s.production_order_id <> t.production_order_id OR s.sku <> t.sku THEN RAISE EXCEPTION 'Batch % belongs to another order or product', s.number; END IF;
    IF s.status IN ('completed','closed','cancelled','running') THEN RAISE EXCEPTION 'Batch % is % and cannot be merged', s.number, s.status; END IF;
    IF s.qty_produced > 0 OR s.qty_scrap > 0 OR s.qty_good > 0 THEN RAISE EXCEPTION 'Batch % already has recorded output and cannot be merged', s.number; END IF;
    UPDATE production_batches SET qty = qty + s.qty WHERE id = t.id;
    UPDATE production_batches SET status = 'cancelled', merged_into = t.id, notes = coalesce(notes || ' · ','') || 'Merged into ' || t.number || ': ' || _reason WHERE id = s.id;
    INSERT INTO batch_links (organization_id, link_type, parent_batch_id, child_batch_id, qty, reason, actor_user_id, actor_name)
    VALUES (t.organization_id, 'merge', s.id, t.id, s.qty, _reason, auth.uid(), actor_name());
  END LOOP;
END $$;

-- ===== Material lots =====
CREATE TABLE public.material_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, sku text NOT NULL, name text,
  lot_number text NOT NULL, kind text NOT NULL DEFAULT 'raw' CHECK (kind IN ('raw','semi_finished','finished','by_product','co_product')),
  qty_received numeric NOT NULL CHECK (qty_received >= 0), qty_remaining numeric NOT NULL, uom text NOT NULL DEFAULT 'kg',
  supplier text, expiry_date date, status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','quarantine','blocked','consumed','expired')),
  location_id text, source_order_id text, source_operation_id uuid, source_receipt_id uuid, notes text,
  actor_user_id uuid, actor_name text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sku, lot_number));
GRANT SELECT, INSERT, UPDATE ON public.material_lots TO authenticated; GRANT ALL ON public.material_lots TO service_role;
ALTER TABLE public.material_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.material_lots FOR SELECT TO authenticated USING (in_my_org(organization_id));
CREATE POLICY "org insert" ON public.material_lots FOR INSERT TO authenticated WITH CHECK (in_my_org(organization_id) AND (has_action(auth.uid(),'material.handle') OR has_action(auth.uid(),'execution.record')));
CREATE POLICY "org update" ON public.material_lots FOR UPDATE TO authenticated USING (in_my_org(organization_id) AND has_action(auth.uid(),'material.handle')) WITH CHECK (in_my_org(organization_id));
CREATE TRIGGER material_lots_updated BEFORE UPDATE ON public.material_lots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION public.guard_material_lot() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.qty_remaining := coalesce(NEW.qty_remaining, NEW.qty_received); END IF;
  IF NEW.qty_remaining < 0 THEN RAISE EXCEPTION 'Lot % would go below zero', NEW.lot_number; END IF;
  IF NEW.qty_remaining > NEW.qty_received THEN RAISE EXCEPTION 'Remaining cannot exceed received quantity'; END IF;
  IF NEW.qty_remaining = 0 AND NEW.status = 'available' THEN NEW.status := 'consumed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER material_lots_guard BEFORE INSERT OR UPDATE ON public.material_lots FOR EACH ROW EXECUTE FUNCTION guard_material_lot();

ALTER TABLE public.material_consumptions ADD COLUMN lot_id uuid REFERENCES public.material_lots(id), ADD COLUMN planned_qty numeric;

CREATE OR REPLACE FUNCTION public.consume_from_lot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE l record;
BEGIN
  IF NEW.lot_id IS NULL AND NEW.input_lot IS NOT NULL THEN
    SELECT id INTO NEW.lot_id FROM material_lots WHERE organization_id = NEW.organization_id AND sku = NEW.component_sku AND lot_number = NEW.input_lot;
  END IF;
  IF NEW.lot_id IS NULL AND NEW.backflush THEN
    SELECT id INTO NEW.lot_id FROM material_lots WHERE organization_id = NEW.organization_id AND sku = NEW.component_sku AND status = 'available' AND qty_remaining >= NEW.qty
      AND (expiry_date IS NULL OR expiry_date >= current_date) ORDER BY coalesce(expiry_date, '9999-12-31'), created_at LIMIT 1;
  END IF;
  IF NEW.lot_id IS NOT NULL THEN
    SELECT * INTO l FROM material_lots WHERE id = NEW.lot_id FOR UPDATE;
    IF l.sku <> NEW.component_sku THEN RAISE EXCEPTION 'Lot % is for %, not %', l.lot_number, l.sku, NEW.component_sku; END IF;
    IF l.status <> 'available' THEN RAISE EXCEPTION 'Lot % is % and cannot be used', l.lot_number, l.status; END IF;
    IF l.expiry_date IS NOT NULL AND l.expiry_date < current_date THEN RAISE EXCEPTION 'Lot % expired on %', l.lot_number, l.expiry_date; END IF;
    IF l.qty_remaining < NEW.qty THEN RAISE EXCEPTION 'Lot % only has % % left', l.lot_number, l.qty_remaining, l.uom; END IF;
    UPDATE material_lots SET qty_remaining = qty_remaining - NEW.qty WHERE id = l.id;
    NEW.input_lot := l.lot_number;
  END IF;
  IF NEW.planned_qty IS NULL THEN
    SELECT planned_qty INTO NEW.planned_qty FROM order_components WHERE production_order_id = NEW.production_order_id AND component_sku = NEW.component_sku LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER material_consumptions_lot BEFORE INSERT ON public.material_consumptions FOR EACH ROW EXECUTE FUNCTION consume_from_lot();

-- Output becomes a traceable lot
CREATE OR REPLACE FUNCTION public.lot_from_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k text;
BEGIN
  IF NEW.qty <= 0 OR NEW.lot_number IS NULL THEN RETURN NEW; END IF;
  k := CASE NEW.receipt_type WHEN 'finished' THEN 'finished' WHEN 'by_product' THEN 'by_product' WHEN 'co_product' THEN 'co_product' WHEN 'semi_finished' THEN 'semi_finished' ELSE 'finished' END;
  INSERT INTO material_lots (organization_id, sku, name, lot_number, kind, qty_received, qty_remaining, uom, source_order_id, source_receipt_id, actor_user_id, actor_name, notes)
  VALUES (NEW.organization_id, NEW.sku, NEW.name, NEW.lot_number, k, NEW.qty, NEW.qty, coalesce(NEW.uom,'kg'), NEW.production_order_id, NEW.id, NEW.actor_user_id, NEW.actor_name, 'From goods receipt')
  ON CONFLICT (organization_id, sku, lot_number) DO UPDATE SET qty_received = material_lots.qty_received + EXCLUDED.qty_received, qty_remaining = material_lots.qty_remaining + EXCLUDED.qty_remaining,
    status = CASE WHEN material_lots.status = 'consumed' THEN 'available' ELSE material_lots.status END;
  RETURN NEW;
END $$;
CREATE TRIGGER goods_receipts_lot AFTER INSERT ON public.goods_receipts FOR EACH ROW EXECUTE FUNCTION lot_from_receipt();

-- Backflush skips components that were consumed by actual (manual) lot scans
CREATE OR REPLACE FUNCTION public.auto_confirm_on_production()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE po record; c record; share numeric; is_last boolean;
BEGIN
  SELECT * INTO po FROM production_orders WHERE id = NEW.production_order_id;
  share := (NEW.qty_yield + NEW.qty_scrap + NEW.qty_rejected) / NULLIF(po.qty, 0);
  is_last := NEW.operation_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM order_operations o2, order_operations o1
    WHERE o1.id = NEW.operation_id AND o2.production_order_id = o1.production_order_id AND o2.sequence > o1.sequence AND o2.status NOT IN ('skipped','cancelled'));
  IF share IS NOT NULL AND share > 0 AND is_last THEN
    FOR c IN SELECT * FROM order_components WHERE production_order_id = NEW.production_order_id LOOP
      IF c.item_type = 'component' AND c.backflush THEN
        IF NOT EXISTS (SELECT 1 FROM material_consumptions m WHERE m.production_order_id = NEW.production_order_id AND m.component_sku = c.component_sku AND NOT m.backflush) THEN
          INSERT INTO material_consumptions (organization_id, production_order_id, batch_id, operation_id, confirmation_id, component_sku, component_name, qty, planned_qty, uom, backflush, actor_user_id, actor_name, notes)
          VALUES (NEW.organization_id, NEW.production_order_id, NEW.batch_id, NEW.operation_id, NEW.id, c.component_sku, c.component_name, round(c.planned_qty * share, 4), round(c.planned_qty * share, 4), c.uom, true, NEW.actor_user_id, NEW.actor_name, 'Automatic backflush');
        END IF;
      ELSIF c.item_type IN ('co_product','by_product') AND c.auto_confirm THEN
        INSERT INTO goods_receipts (organization_id, production_order_id, batch_id, confirmation_id, receipt_type, sku, name, qty, uom, lot_number, auto, actor_user_id, actor_name)
        VALUES (NEW.organization_id, NEW.production_order_id, NEW.batch_id, NEW.id, c.item_type, c.component_sku, c.component_name, round(c.planned_qty * share, 4), c.uom, po.lot_number, true, NEW.actor_user_id, NEW.actor_name);
      END IF;
    END LOOP;
  END IF;
  IF NEW.post_goods_receipt AND NEW.qty_yield > 0 AND is_last THEN
    INSERT INTO goods_receipts (organization_id, production_order_id, batch_id, confirmation_id, receipt_type, sku, name, qty, uom, lot_number, auto, actor_user_id, actor_name)
    VALUES (NEW.organization_id, NEW.production_order_id, NEW.batch_id, NEW.id, 'finished', po.sku, po.product_name, NEW.qty_yield, po.uom, po.lot_number, true, NEW.actor_user_id, NEW.actor_name);
  END IF;
  IF NEW.operation_id IS NOT NULL THEN
    UPDATE order_operations SET qty_yield = qty_yield + NEW.qty_yield, qty_scrap = qty_scrap + NEW.qty_scrap,
      qty_rejected = qty_rejected + NEW.qty_rejected,
      qty_processed = qty_processed + NEW.qty_yield + NEW.qty_scrap + NEW.qty_rejected,
      status = CASE WHEN NEW.final THEN 'completed' ELSE 'partially_completed' END,
      status_reason = CASE WHEN NEW.final THEN coalesce(NEW.completion_reason, 'Final confirmation') ELSE 'Partial confirmation' END,
      completion_reason = CASE WHEN NEW.final THEN NEW.completion_reason ELSE completion_reason END,
      completion_notes = CASE WHEN NEW.final THEN NEW.notes ELSE completion_notes END,
      completed_by = CASE WHEN NEW.final THEN NEW.actor_name ELSE completed_by END
    WHERE id = NEW.operation_id;
  END IF;
  RETURN NEW;
END $function$;

CREATE VIEW public.lot_genealogy WITH (security_invoker = true) AS
  SELECT m.organization_id, m.production_order_id, m.input_lot AS input_lot, m.component_sku AS input_sku, m.lot_id AS input_lot_id,
         sum(m.qty) AS qty_used, m.uom, po.lot_number AS output_lot, po.sku AS output_sku, po.product_name AS output_name
  FROM material_consumptions m JOIN production_orders po ON po.id = m.production_order_id
  WHERE m.input_lot IS NOT NULL
  GROUP BY m.organization_id, m.production_order_id, m.input_lot, m.component_sku, m.lot_id, m.uom, po.lot_number, po.sku, po.product_name;
GRANT SELECT ON public.lot_genealogy TO authenticated;

-- ===== Rework tasks =====
CREATE TABLE public.rework_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL, production_order_id text NOT NULL,
  operation_id uuid, batch_id text, qty numeric NOT NULL CHECK (qty > 0), uom text, reason text NOT NULL, instructions text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','awaiting_inspection','passed','failed','scrapped')),
  assigned_to text, inspection_source text CHECK (inspection_source IN ('local','qa_portal')), inspection_result text, inspection_notes text, inspector_name text,
  attempts int NOT NULL DEFAULT 1, created_by_name text, created_by_user_id uuid, completed_at timestamptz, inspected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.rework_tasks TO authenticated; GRANT ALL ON public.rework_tasks TO service_role;
ALTER TABLE public.rework_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.rework_tasks FOR SELECT TO authenticated USING (in_my_org(organization_id));
CREATE POLICY "org insert" ON public.rework_tasks FOR INSERT TO authenticated WITH CHECK (in_my_org(organization_id) AND (has_action(auth.uid(),'execution.rework') OR has_action(auth.uid(),'execution.override')));
CREATE POLICY "org update" ON public.rework_tasks FOR UPDATE TO authenticated USING (in_my_org(organization_id) AND (has_action(auth.uid(),'execution.rework') OR has_action(auth.uid(),'execution.record') OR has_action(auth.uid(),'holds.release'))) WITH CHECK (in_my_org(organization_id));
CREATE OR REPLACE FUNCTION public.guard_rework_task() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE ok text[];
BEGIN
  NEW.updated_at := now();
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  ok := CASE OLD.status WHEN 'open' THEN ARRAY['in_progress','scrapped'] WHEN 'in_progress' THEN ARRAY['awaiting_inspection','scrapped']
    WHEN 'awaiting_inspection' THEN ARRAY['passed','failed'] WHEN 'failed' THEN ARRAY['open','scrapped'] ELSE ARRAY[]::text[] END;
  IF NOT NEW.status = ANY(ok) THEN RAISE EXCEPTION 'A rework task cannot go from % to %', OLD.status, NEW.status; END IF;
  IF NEW.status = 'awaiting_inspection' THEN NEW.completed_at := now(); END IF;
  IF NEW.status IN ('passed','failed') THEN
    IF NEW.inspection_source IS NULL THEN RAISE EXCEPTION 'Record where the re-inspection came from'; END IF;
    IF NEW.status = 'failed' AND coalesce(trim(NEW.inspection_notes),'') = '' THEN RAISE EXCEPTION 'A failed re-inspection needs notes'; END IF;
    NEW.inspection_result := NEW.status; NEW.inspected_at := now();
  END IF;
  IF OLD.status = 'failed' AND NEW.status = 'open' THEN NEW.attempts := OLD.attempts + 1; NEW.inspection_result := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER rework_tasks_guard BEFORE UPDATE ON public.rework_tasks FOR EACH ROW EXECUTE FUNCTION guard_rework_task();

-- ===== External Maintenance / QA portals =====
CREATE TABLE public.portal_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  portal text NOT NULL CHECK (portal IN ('maintenance','qa')), name text NOT NULL, outbound_url text, shared_secret text NOT NULL,
  active boolean NOT NULL DEFAULT true, last_sent_at timestamptz, last_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_connections TO authenticated; GRANT ALL ON public.portal_connections TO service_role;
ALTER TABLE public.portal_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage" ON public.portal_connections FOR ALL TO authenticated
  USING (in_my_org(organization_id) AND (has_action(auth.uid(),'users.admin') OR has_action(auth.uid(),'platform.admin')))
  WITH CHECK (in_my_org(organization_id) AND (has_action(auth.uid(),'users.admin') OR has_action(auth.uid(),'platform.admin')));
CREATE TRIGGER portal_connections_updated BEFORE UPDATE ON public.portal_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE public.portal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('out','in')), portal text NOT NULL CHECK (portal IN ('maintenance','qa')),
  event_type text NOT NULL, ref_table text, ref_id text, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','applied','rejected')),
  attempts int NOT NULL DEFAULT 0, last_error text, connection_id uuid, processed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX portal_events_pending ON public.portal_events (status, direction, created_at);
GRANT SELECT ON public.portal_events TO authenticated; GRANT ALL ON public.portal_events TO service_role;
ALTER TABLE public.portal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.portal_events FOR SELECT TO authenticated USING (in_my_org(organization_id));

CREATE OR REPLACE FUNCTION public.enqueue_portal_event(_org text, _portal text, _type text, _ref_table text, _ref_id text, _payload jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO portal_events (organization_id, direction, portal, event_type, ref_table, ref_id, payload)
  VALUES (_org, 'out', _portal, _type, _ref_table, _ref_id, _payload) $$;
REVOKE EXECUTE ON FUNCTION public.enqueue_portal_event(text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_emit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_TABLE_NAME = 'station_holds' AND TG_OP = 'INSERT' AND NEW.hold_type IN ('qc','maintenance') THEN
    PERFORM enqueue_portal_event(NEW.organization_id, CASE WHEN NEW.hold_type = 'qc' THEN 'qa' ELSE 'maintenance' END, 'hold_placed', 'station_holds', NEW.id::text,
      jsonb_build_object('station_hold_id', NEW.id, 'station_id', NEW.station_id, 'reason', NEW.reason, 'opened_by', NEW.opened_by_name, 'opened_at', NEW.opened_at));
  ELSIF TG_TABLE_NAME = 'production_exceptions' AND TG_OP = 'INSERT' AND NEW.exception_type IN ('machine_failure','tool_failure') THEN
    PERFORM enqueue_portal_event(NEW.organization_id, 'maintenance', 'equipment_fault', 'production_exceptions', NEW.id::text, to_jsonb(NEW));
  ELSIF TG_TABLE_NAME = 'production_exceptions' AND TG_OP = 'INSERT' AND NEW.exception_type IN ('quality_interruption','process_deviation') THEN
    PERFORM enqueue_portal_event(NEW.organization_id, 'qa', 'quality_issue', 'production_exceptions', NEW.id::text, to_jsonb(NEW));
  ELSIF TG_TABLE_NAME = 'rework_tasks' AND NEW.status = 'awaiting_inspection' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM enqueue_portal_event(NEW.organization_id, 'qa', 'inspection_requested', 'rework_tasks', NEW.id::text,
      jsonb_build_object('rework_task_id', NEW.id, 'production_order_id', NEW.production_order_id, 'batch_id', NEW.batch_id, 'qty', NEW.qty, 'uom', NEW.uom, 'reason', NEW.reason, 'attempt', NEW.attempts));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER station_holds_portal AFTER INSERT ON public.station_holds FOR EACH ROW EXECUTE FUNCTION portal_emit();
CREATE TRIGGER production_exceptions_portal AFTER INSERT ON public.production_exceptions FOR EACH ROW EXECUTE FUNCTION portal_emit();
CREATE TRIGGER rework_tasks_portal AFTER INSERT OR UPDATE ON public.rework_tasks FOR EACH ROW EXECUTE FUNCTION portal_emit();
