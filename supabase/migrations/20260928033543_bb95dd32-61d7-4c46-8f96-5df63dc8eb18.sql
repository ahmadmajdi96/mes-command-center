
-- ===== Reasons: scrap vs reject =====
ALTER TABLE public.waste_reasons ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'scrap' CHECK (kind IN ('scrap','reject','both'));

-- ===== Routing operation rules =====
ALTER TABLE public.routing_operations
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS required_fields text[] NOT NULL DEFAULT '{}';

-- ===== Order operations =====
DO $$ DECLARE c text; BEGIN
  SELECT conname INTO c FROM pg_constraint WHERE conrelid = 'public.order_operations'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.order_operations DROP CONSTRAINT %I', c); END IF;
END $$;
ALTER TABLE public.order_operations
  ADD CONSTRAINT order_operations_status_check CHECK (status IN ('pending','ready','running','partially_completed','completed','on_hold','blocked','cancelled','rework_required','skipped')),
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS required_fields text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_name text,
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS approval_comment text,
  ADD COLUMN IF NOT EXISTS qty_input numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_processed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_rejected numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS machine_id text,
  ADD COLUMN IF NOT EXISTS station_id text,
  ADD COLUMN IF NOT EXISTS batch_id text,
  ADD COLUMN IF NOT EXISTS parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS started_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS completion_reason text,
  ADD COLUMN IF NOT EXISTS completion_notes text,
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS hold_category text,
  ADD COLUMN IF NOT EXISTS setup_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS setup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_setup_min numeric,
  ADD COLUMN IF NOT EXISTS actual_processing_min numeric,
  ADD COLUMN IF NOT EXISTS actual_waiting_min numeric,
  ADD COLUMN IF NOT EXISTS actual_downtime_min numeric,
  ADD COLUMN IF NOT EXISTS actual_duration_min numeric;

-- ===== Confirmations =====
ALTER TABLE public.production_confirmations
  ADD COLUMN IF NOT EXISTS qty_rejected numeric NOT NULL DEFAULT 0 CHECK (qty_rejected >= 0),
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS qty_input numeric,
  ADD COLUMN IF NOT EXISTS qty_produced numeric,
  ADD COLUMN IF NOT EXISTS completion_reason text;

-- ===== Operation events (append-only step history) =====
CREATE TABLE public.operation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  production_order_id text NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL REFERENCES public.order_operations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  actor_name text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.operation_events(operation_id, at);
CREATE INDEX ON public.operation_events(production_order_id, at);
GRANT SELECT, INSERT ON public.operation_events TO authenticated;
GRANT ALL ON public.operation_events TO service_role;
ALTER TABLE public.operation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.operation_events FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY "org insert" ON public.operation_events FOR INSERT TO authenticated WITH CHECK (public.in_my_org(organization_id) AND public.has_action(auth.uid(),'execution.record'));
CREATE TRIGGER operation_events_append_only BEFORE UPDATE OR DELETE ON public.operation_events FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

-- ===== Production exceptions =====
CREATE TABLE public.production_exceptions (
  id text PRIMARY KEY DEFAULT ('EX-' || to_char(now(),'YYMMDD') || '-' || substr(md5(random()::text),1,6)),
  organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  exception_type text NOT NULL CHECK (exception_type IN ('machine_failure','material_shortage','tool_failure','process_deviation','production_interruption','resource_unavailable','quality_interruption','other')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  production_order_id text REFERENCES public.production_orders(id) ON DELETE SET NULL,
  operation_id uuid REFERENCES public.order_operations(id) ON DELETE SET NULL,
  line_id text,
  station_id text,
  machine_id text,
  resource text,
  operator_name text,
  operator_user_id uuid,
  reason_code text,
  description text NOT NULL,
  resolution text,
  blocks_execution boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  resolved_by_name text,
  resolved_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX ON public.production_exceptions(production_order_id);
CREATE INDEX ON public.production_exceptions(status);
GRANT SELECT, INSERT, UPDATE ON public.production_exceptions TO authenticated;
GRANT ALL ON public.production_exceptions TO service_role;
ALTER TABLE public.production_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.production_exceptions FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY "org insert" ON public.production_exceptions FOR INSERT TO authenticated WITH CHECK (public.in_my_org(organization_id) AND (public.has_action(auth.uid(),'execution.record') OR public.has_action(auth.uid(),'downtime.record')));
CREATE POLICY "org update" ON public.production_exceptions FOR UPDATE TO authenticated USING (public.in_my_org(organization_id) AND (public.has_action(auth.uid(),'execution.record') OR public.has_action(auth.uid(),'downtime.record'))) WITH CHECK (public.in_my_org(organization_id));

CREATE OR REPLACE FUNCTION public.guard_exception_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'resolved' THEN RAISE EXCEPTION 'A resolved exception can no longer be changed'; END IF;
  IF NEW.exception_type IS DISTINCT FROM OLD.exception_type OR NEW.production_order_id IS DISTINCT FROM OLD.production_order_id
     OR NEW.operation_id IS DISTINCT FROM OLD.operation_id OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.description IS DISTINCT FROM OLD.description OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Only the resolution, end time and status of an exception can be changed';
  END IF;
  IF NEW.status = 'resolved' THEN
    IF coalesce(trim(NEW.resolution),'') = '' THEN RAISE EXCEPTION 'A resolution is required to close an exception'; END IF;
    NEW.ended_at := coalesce(NEW.ended_at, now());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER production_exceptions_guard BEFORE UPDATE ON public.production_exceptions FOR EACH ROW EXECUTE FUNCTION public.guard_exception_update();
CREATE TRIGGER production_exceptions_no_delete BEFORE DELETE ON public.production_exceptions FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

-- ===== Order holds =====
CREATE TABLE public.order_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  production_order_id text NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  hold_type text NOT NULL DEFAULT 'other' CHECK (hold_type IN ('quality','material','planning','customer','equipment','other')),
  reason text NOT NULL,
  comments text,
  prev_status text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','released')),
  opened_by_user_id uuid,
  opened_by_name text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  released_by_user_id uuid,
  released_by_name text,
  released_at timestamptz,
  release_comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.order_holds(production_order_id, status);
GRANT SELECT, INSERT, UPDATE ON public.order_holds TO authenticated;
GRANT ALL ON public.order_holds TO service_role;
ALTER TABLE public.order_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read" ON public.order_holds FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY "org insert" ON public.order_holds FOR INSERT TO authenticated WITH CHECK (public.in_my_org(organization_id) AND public.has_action(auth.uid(),'holds.raise'));
CREATE POLICY "org release" ON public.order_holds FOR UPDATE TO authenticated USING (public.in_my_org(organization_id) AND (public.has_action(auth.uid(),'holds.release') OR public.has_action(auth.uid(),'execution.override'))) WITH CHECK (public.in_my_org(organization_id));

CREATE OR REPLACE FUNCTION public.guard_order_hold_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'released' THEN RAISE EXCEPTION 'This hold is already released'; END IF;
  IF NEW.reason IS DISTINCT FROM OLD.reason OR NEW.production_order_id IS DISTINCT FROM OLD.production_order_id
     OR NEW.opened_at IS DISTINCT FROM OLD.opened_at OR NEW.hold_type IS DISTINCT FROM OLD.hold_type THEN
    RAISE EXCEPTION 'Only the release of a hold can be recorded';
  END IF;
  IF NEW.status = 'released' THEN
    IF coalesce(trim(NEW.release_comments),'') = '' THEN RAISE EXCEPTION 'Release comments are required'; END IF;
    NEW.released_at := coalesce(NEW.released_at, now());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER order_holds_guard BEFORE UPDATE ON public.order_holds FOR EACH ROW EXECUTE FUNCTION public.guard_order_hold_update();
CREATE TRIGGER order_holds_no_delete BEFORE DELETE ON public.order_holds FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

-- ===== Status transitions (hold from scheduled/released, back to prior status) =====
CREATE OR REPLACE FUNCTION public.assert_status_transition(_entity text, _from text, _to text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE allowed text[];
BEGIN
  IF _from IS NULL OR _to IS NULL OR _from = _to THEN RETURN; END IF;
  allowed := CASE _from
    WHEN 'scheduled' THEN ARRAY['planned','released','hold','cancelled']
    WHEN 'planned'   THEN ARRAY['scheduled','released','hold','cancelled']
    WHEN 'released'  THEN ARRAY['scheduled','planned','running','hold','cancelled']
    WHEN 'running'   THEN ARRAY['paused','hold','completed','finished','cancelled']
    WHEN 'paused'    THEN ARRAY['running','hold','cancelled']
    WHEN 'hold'      THEN ARRAY['scheduled','planned','released','running','paused','cancelled']
    WHEN 'completed' THEN ARRAY['closed']
    WHEN 'finished'  THEN ARRAY['closed']
    WHEN 'closed'    THEN ARRAY[]::text[]
    WHEN 'cancelled' THEN ARRAY[]::text[]
    ELSE NULL END;
  IF allowed IS NULL THEN RETURN; END IF;
  IF NOT (_to = ANY(allowed)) THEN
    RAISE EXCEPTION 'A % cannot go from % to %. Allowed next steps: %', _entity, _from, _to,
      CASE WHEN array_length(allowed,1) IS NULL THEN 'none' ELSE array_to_string(allowed, ', ') END;
  END IF;
END $$;

-- ===== Release readiness =====
CREATE OR REPLACE FUNCTION public.order_release_check(_po_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE po record; out jsonb := '[]'::jsonb; n int; n2 int; ln record; short text;
  PROCEDURE_DUMMY int;
BEGIN
  SELECT * INTO po FROM production_orders WHERE id = _po_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', _po_id; END IF;
  out := out || jsonb_build_object('key','qty','label','Planned quantity is above zero','ok', po.qty > 0,'blocking',true,'detail', po.qty || ' ' || po.uom);
  out := out || jsonb_build_object('key','product','label','Order is linked to a product','ok', po.product_id IS NOT NULL,'blocking',false,'detail', coalesce(po.product_id, 'Only SKU ' || po.sku));
  SELECT count(*) INTO n FROM order_operations WHERE production_order_id = _po_id AND status <> 'cancelled';
  out := out || jsonb_build_object('key','operations','label','Order has operations (routing)','ok', n > 0,'blocking',true,'detail', n || ' operation(s)');
  out := out || jsonb_build_object('key','version','label','Production version applied','ok', po.production_version_id IS NOT NULL,'blocking',false,'detail', coalesce(po.production_version_id,'None — operations were added by hand'));
  SELECT count(*) INTO n FROM order_components WHERE production_order_id = _po_id AND item_type = 'component';
  out := out || jsonb_build_object('key','materials','label','Required materials listed','ok', n > 0,'blocking',false,'detail', n || ' component(s)');
  SELECT string_agg(c.component_sku || ' needs ' || c.planned_qty || ' ' || c.uom || ', stock ' || coalesce(s.qty,0), '; ') INTO short
    FROM order_components c LEFT JOIN stock_on_hand s ON s.sku = c.component_sku AND s.organization_id = c.organization_id
    WHERE c.production_order_id = _po_id AND c.item_type = 'component' AND coalesce(s.qty,0) < c.planned_qty;
  out := out || jsonb_build_object('key','stock','label','Material stock covers the plan','ok', short IS NULL,'blocking',false,'detail', coalesce(short,'All components covered'));
  SELECT * INTO ln FROM lines WHERE id = po.line_id;
  out := out || jsonb_build_object('key','line','label','Production line assigned','ok', ln.id IS NOT NULL,'blocking',true,'detail', coalesce(po.line_id,'No line'));
  IF ln.id IS NOT NULL THEN
    out := out || jsonb_build_object('key','line_status','label','Line is available','ok', ln.status NOT IN ('maintenance','down','offline'),'blocking',false,'detail', ln.name || ' is ' || ln.status);
  END IF;
  SELECT count(*) INTO n FROM order_operations o WHERE o.production_order_id = _po_id AND o.work_center_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM work_centers w WHERE w.id = o.work_center_id);
  SELECT count(*) INTO n2 FROM order_operations o WHERE o.production_order_id = _po_id AND o.work_center_id IS NULL;
  out := out || jsonb_build_object('key','resources','label','Every operation has a known work center','ok', n = 0 AND n2 = 0,'blocking',false,'detail', CASE WHEN n = 0 AND n2 = 0 THEN 'All set' ELSE (n + n2) || ' operation(s) without a valid work center' END);
  SELECT count(*) INTO n FROM order_operations WHERE production_order_id = _po_id AND coalesce(trim(work_instructions),'') = '';
  out := out || jsonb_build_object('key','instructions','label','Every operation has work instructions','ok', n = 0,'blocking',false,'detail', CASE WHEN n = 0 THEN 'All set' ELSE n || ' operation(s) without instructions' END);
  out := out || jsonb_build_object('key','schedule','label','Planned start date set','ok', po.planned_start IS NOT NULL,'blocking',true,'detail', coalesce(to_char(po.planned_start,'YYYY-MM-DD HH24:MI'),'Not scheduled'));
  out := out || jsonb_build_object('key','dates','label','Planned end is after start','ok', po.planned_end IS NULL OR po.planned_start IS NULL OR po.planned_end >= po.planned_start,'blocking',true,'detail', coalesce(to_char(po.planned_end,'YYYY-MM-DD HH24:MI'),'No end date'));
  SELECT count(*) INTO n FROM order_holds WHERE production_order_id = _po_id AND status = 'open';
  out := out || jsonb_build_object('key','holds','label','No open order hold','ok', n = 0,'blocking',true,'detail', n || ' open hold(s)');
  SELECT count(*) INTO n FROM production_exceptions WHERE production_order_id = _po_id AND status = 'open' AND blocks_execution;
  out := out || jsonb_build_object('key','exceptions','label','No open blocking exception','ok', n = 0,'blocking',true,'detail', n || ' open blocking exception(s)');
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.order_release_check(text) TO authenticated;

-- ===== Order lifecycle guard =====
CREATE OR REPLACE FUNCTION public.guard_order_lifecycle() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE fails text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.assert_status_transition('production order', OLD.status, NEW.status);
    IF OLD.status = 'hold' AND NEW.status <> 'cancelled' AND EXISTS (SELECT 1 FROM order_holds h WHERE h.production_order_id = NEW.id AND h.status = 'open') THEN
      RAISE EXCEPTION 'This order has an open hold. Release the hold first';
    END IF;
    IF NEW.status = 'released' AND OLD.status IN ('scheduled','planned') THEN
      SELECT string_agg(e->>'label', '; ') INTO fails FROM jsonb_array_elements(public.order_release_check(NEW.id)) e
        WHERE (e->>'blocking')::boolean AND NOT (e->>'ok')::boolean;
      IF fails IS NOT NULL THEN RAISE EXCEPTION 'The order cannot be released yet: %', fails; END IF;
    END IF;
    IF NEW.status IN ('completed','finished','closed') THEN
      IF EXISTS (SELECT 1 FROM production_batches b WHERE b.production_order_id = NEW.id AND b.status NOT IN ('completed','finished','closed','cancelled')) THEN
        RAISE EXCEPTION 'This order still has batches that are not completed or cancelled';
      END IF;
      IF NEW.status IN ('completed','finished') AND EXISTS (SELECT 1 FROM order_operations o WHERE o.production_order_id = NEW.id AND o.status NOT IN ('completed','skipped','cancelled')) THEN
        RAISE EXCEPTION 'All operations must be completed, skipped or cancelled before the order can be completed';
      END IF;
      IF EXISTS (SELECT 1 FROM order_holds h WHERE h.production_order_id = NEW.id AND h.status = 'open') THEN
        RAISE EXCEPTION 'This order has an open hold';
      END IF;
      IF EXISTS (SELECT 1 FROM production_exceptions x WHERE x.production_order_id = NEW.id AND x.status = 'open') THEN
        RAISE EXCEPTION 'Resolve the open exceptions on this order first';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ===== Operation guard =====
CREATE OR REPLACE FUNCTION public.operation_block_reason(_op_id uuid, _check_sequence boolean)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE op record; po record; prev record;
BEGIN
  SELECT * INTO op FROM order_operations WHERE id = _op_id;
  SELECT * INTO po FROM production_orders WHERE id = op.production_order_id;
  IF po.status NOT IN ('released','running') THEN RETURN 'The order is ' || po.status || ' — it must be released or running'; END IF;
  IF EXISTS (SELECT 1 FROM order_holds h WHERE h.production_order_id = po.id AND h.status = 'open') THEN RETURN 'The order has an open hold'; END IF;
  IF EXISTS (SELECT 1 FROM production_exceptions x WHERE x.status = 'open' AND x.blocks_execution
             AND (x.operation_id = op.id OR (x.operation_id IS NULL AND x.production_order_id = po.id))) THEN
    RETURN 'An open blocking exception stops this operation';
  END IF;
  IF op.station_id IS NOT NULL AND EXISTS (SELECT 1 FROM station_holds s WHERE s.station_id = op.station_id AND s.status = 'open') THEN
    RETURN 'Station ' || op.station_id || ' has an open hold';
  END IF;
  IF _check_sequence THEN
    FOR prev IN SELECT * FROM order_operations WHERE production_order_id = op.production_order_id AND sequence < op.sequence AND status NOT IN ('skipped','cancelled') ORDER BY sequence LOOP
      IF prev.status NOT IN ('completed','partially_completed') THEN
        RETURN 'Previous operation "' || prev.name || '" is ' || replace(prev.status,'_',' ');
      END IF;
      IF prev.status = 'partially_completed' AND prev.qty_yield <= 0 THEN
        RETURN 'Previous operation "' || prev.name || '" has no accepted quantity yet';
      END IF;
      IF prev.requires_approval AND prev.approved_at IS NULL THEN
        RETURN 'Previous operation "' || prev.name || '" needs approval';
      END IF;
    END LOOP;
  END IF;
  RETURN NULL;
END $$;
GRANT EXECUTE ON FUNCTION public.operation_block_reason(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.operation_hold_minutes(_op_id uuid, _until timestamptz, OUT downtime_min numeric, OUT waiting_min numeric)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH ev AS (
    SELECT at, payload->>'to' AS to_s, coalesce(payload->>'category','waiting') AS cat,
           lead(at) OVER (ORDER BY at) AS nxt
    FROM operation_events WHERE operation_id = _op_id AND event_type = 'status_change'
  )
  SELECT
    coalesce(round(sum(extract(epoch FROM (coalesce(nxt,_until) - at)) / 60) FILTER (WHERE to_s = 'on_hold' AND cat = 'downtime')::numeric, 1), 0),
    coalesce(round(sum(extract(epoch FROM (coalesce(nxt,_until) - at)) / 60) FILTER (WHERE to_s = 'on_hold' AND cat <> 'downtime')::numeric, 1), 0)
  FROM ev
$$;

CREATE OR REPLACE FUNCTION public.guard_order_operation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE why text; prev_done timestamptz; h record; dur numeric; setup numeric;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF OLD.status IN ('cancelled','skipped') THEN RAISE EXCEPTION 'Operation "%" is % and can no longer change', OLD.name, OLD.status; END IF;
  IF OLD.status = 'completed' AND NEW.status <> 'rework_required' THEN
    RAISE EXCEPTION 'Operation "%" is completed; only "rework required" can reopen it', OLD.name;
  END IF;
  IF OLD.status = 'blocked' AND NEW.status NOT IN ('ready','pending','cancelled') THEN
    RAISE EXCEPTION 'Operation "%" is blocked — unblock it first', OLD.name;
  END IF;
  IF OLD.status = 'on_hold' AND NEW.status IN ('partially_completed','completed') THEN
    RAISE EXCEPTION 'Operation "%" is on hold — resume it first', OLD.name;
  END IF;
  IF NEW.status IN ('running','partially_completed','completed') THEN
    why := public.operation_block_reason(NEW.id, OLD.status IN ('pending','ready','rework_required'));
    IF why IS NOT NULL THEN RAISE EXCEPTION 'Operation "%" cannot proceed: %', NEW.name, why; END IF;
  END IF;
  IF NEW.status = 'running' AND NEW.started_at IS NULL THEN NEW.started_at := now(); END IF;
  IF NEW.status = 'completed' THEN
    NEW.completed_at := coalesce(NEW.completed_at, now());
    NEW.started_at := coalesce(NEW.started_at, NEW.completed_at);
    SELECT max(completed_at) INTO prev_done FROM order_operations WHERE production_order_id = NEW.production_order_id AND sequence < NEW.sequence;
    h := public.operation_hold_minutes(NEW.id, NEW.completed_at);
    dur := round((extract(epoch FROM (NEW.completed_at - NEW.started_at)) / 60)::numeric, 1);
    setup := CASE WHEN NEW.setup_started_at IS NOT NULL THEN round((extract(epoch FROM (coalesce(NEW.setup_completed_at, NEW.completed_at) - NEW.setup_started_at)) / 60)::numeric, 1) ELSE 0 END;
    NEW.actual_duration_min := dur;
    NEW.actual_setup_min := setup;
    NEW.actual_downtime_min := h.downtime_min;
    NEW.actual_waiting_min := h.waiting_min + CASE WHEN prev_done IS NOT NULL AND NEW.started_at > prev_done THEN round((extract(epoch FROM (NEW.started_at - prev_done)) / 60)::numeric, 1) ELSE 0 END;
    NEW.actual_processing_min := greatest(0, dur - setup - h.downtime_min - h.waiting_min);
  END IF;
  IF NEW.status = 'rework_required' THEN NEW.completed_at := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_operations_guard BEFORE UPDATE ON public.order_operations FOR EACH ROW EXECUTE FUNCTION public.guard_order_operation();

CREATE OR REPLACE FUNCTION public.log_operation_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text; nxt uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT coalesce(full_name, email) INTO nm FROM profiles WHERE id = auth.uid();
  INSERT INTO operation_events (organization_id, production_order_id, operation_id, event_type, reason, payload, actor_user_id, actor_name)
  VALUES (NEW.organization_id, NEW.production_order_id, NEW.id, 'status_change', NEW.status_reason,
          jsonb_build_object('from', OLD.status, 'to', NEW.status, 'category', NEW.hold_category), auth.uid(), coalesce(nm, 'System'));
  IF NEW.status IN ('completed','skipped','cancelled') THEN
    SELECT id INTO nxt FROM order_operations WHERE production_order_id = NEW.production_order_id AND sequence > NEW.sequence AND status NOT IN ('skipped','cancelled') ORDER BY sequence LIMIT 1;
    IF nxt IS NOT NULL THEN UPDATE order_operations SET status = 'ready', status_reason = 'Previous operation finished' WHERE id = nxt AND status = 'pending'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_operation_status() FROM anon, authenticated, public;
CREATE TRIGGER order_operations_log AFTER UPDATE ON public.order_operations FOR EACH ROW EXECUTE FUNCTION public.log_operation_status();

CREATE OR REPLACE FUNCTION public.ready_first_operation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_id uuid;
BEGIN
  IF NEW.status IN ('released','running') AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT id INTO first_id FROM order_operations o WHERE o.production_order_id = NEW.id AND o.status NOT IN ('skipped','cancelled') ORDER BY sequence LIMIT 1;
    IF first_id IS NOT NULL THEN UPDATE order_operations SET status = 'ready', status_reason = 'Order released' WHERE id = first_id AND status = 'pending'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.ready_first_operation() FROM anon, authenticated, public;
CREATE TRIGGER production_orders_ready_first AFTER UPDATE ON public.production_orders FOR EACH ROW EXECUTE FUNCTION public.ready_first_operation();

-- ===== Confirmation guard + updated posting =====
CREATE OR REPLACE FUNCTION public.guard_confirmation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE po record;
BEGIN
  SELECT * INTO po FROM production_orders WHERE id = NEW.production_order_id;
  IF po.status NOT IN ('released','running') THEN RAISE EXCEPTION 'Quantities can only be confirmed while the order is released or running (order is %)', po.status; END IF;
  IF EXISTS (SELECT 1 FROM order_holds h WHERE h.production_order_id = po.id AND h.status = 'open') THEN RAISE EXCEPTION 'The order has an open hold'; END IF;
  IF NEW.qty_rejected > 0 AND coalesce(trim(NEW.reject_reason),'') = '' THEN RAISE EXCEPTION 'Rejected quantity needs a reject reason'; END IF;
  IF NEW.qty_scrap > 0 AND coalesce(trim(NEW.scrap_reason),'') = '' THEN RAISE EXCEPTION 'Scrap quantity needs a scrap reason'; END IF;
  IF NEW.qty_produced IS NULL THEN NEW.qty_produced := NEW.qty_yield + NEW.qty_rejected + NEW.qty_scrap; END IF;
  IF NEW.qty_produced <> NEW.qty_yield + NEW.qty_rejected + NEW.qty_scrap THEN
    RAISE EXCEPTION 'Produced (%) must equal accepted + rejected + scrap (%)', NEW.qty_produced, NEW.qty_yield + NEW.qty_rejected + NEW.qty_scrap;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER production_confirmations_guard BEFORE INSERT ON public.production_confirmations FOR EACH ROW EXECUTE FUNCTION public.guard_confirmation();

CREATE OR REPLACE FUNCTION public.auto_confirm_on_production()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
        INSERT INTO material_consumptions (organization_id, production_order_id, batch_id, operation_id, confirmation_id, component_sku, component_name, qty, uom, backflush, actor_user_id, actor_name, notes)
        VALUES (NEW.organization_id, NEW.production_order_id, NEW.batch_id, NEW.operation_id, NEW.id, c.component_sku, c.component_name, round(c.planned_qty * share, 4), c.uom, true, NEW.actor_user_id, NEW.actor_name, 'Automatic backflush');
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

-- ===== Copy routing rules onto orders =====
CREATE OR REPLACE FUNCTION public.apply_production_version(_po_id text, _version_id text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE po record; pv record; bom record; factor numeric;
BEGIN
  SELECT * INTO po FROM production_orders WHERE id = _po_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', _po_id; END IF;
  IF po.status NOT IN ('scheduled','planned','released') THEN
    RAISE EXCEPTION 'The execution scenario can only be changed before the order starts (order is %)', po.status;
  END IF;
  SELECT * INTO pv FROM production_versions WHERE id = _version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Production version % not found', _version_id; END IF;
  IF pv.sku <> po.sku THEN RAISE EXCEPTION 'Version % is for %, not %', pv.version, pv.sku, po.sku; END IF;
  IF (pv.valid_from IS NOT NULL AND pv.valid_from > current_date) OR (pv.valid_to IS NOT NULL AND pv.valid_to < current_date) THEN
    RAISE EXCEPTION 'Production version % is not valid today', pv.version;
  END IF;
  IF EXISTS (SELECT 1 FROM production_confirmations WHERE production_order_id = _po_id) THEN
    RAISE EXCEPTION 'Order already has confirmations; its routing can no longer be replaced';
  END IF;
  DELETE FROM order_operations WHERE production_order_id = _po_id;
  DELETE FROM order_components WHERE production_order_id = _po_id;
  INSERT INTO order_operations (organization_id, production_order_id, sequence, name, work_center_id, work_instructions, setup_min, run_min_per_unit, requires_approval, required_fields, status)
    SELECT po.organization_id, _po_id, sequence, name, work_center_id, work_instructions, setup_min, run_min_per_unit, requires_approval, required_fields, 'pending'
    FROM routing_operations WHERE routing_id = pv.routing_id ORDER BY sequence;
  IF po.status = 'released' THEN
    UPDATE order_operations SET status = 'ready' WHERE id = (SELECT id FROM order_operations WHERE production_order_id = _po_id ORDER BY sequence LIMIT 1);
  END IF;
  SELECT * INTO bom FROM boms WHERE id = pv.bom_id;
  IF FOUND THEN
    factor := po.qty / NULLIF(bom.base_qty, 0);
    INSERT INTO order_components (organization_id, production_order_id, item_type, component_product_id, component_sku, component_name, planned_qty, uom, backflush, auto_confirm)
      SELECT po.organization_id, _po_id, item_type, component_product_id, component_sku, component_name, round(qty * coalesce(factor,1), 4), uom, backflush, auto_confirm
      FROM bom_items WHERE bom_id = bom.id ORDER BY sequence;
  END IF;
  UPDATE production_orders SET production_version_id = _version_id WHERE id = _po_id;
END $$;

-- ===== Backfill: first open step of released/running orders becomes Ready =====
UPDATE public.order_operations o SET status = 'ready'
WHERE o.status = 'pending'
  AND EXISTS (SELECT 1 FROM public.production_orders p WHERE p.id = o.production_order_id AND p.status IN ('released','running'))
  AND NOT EXISTS (SELECT 1 FROM public.order_operations x WHERE x.production_order_id = o.production_order_id AND x.sequence < o.sequence AND x.status NOT IN ('completed','skipped','cancelled'));

-- ===== Reject reasons =====
INSERT INTO public.waste_reasons (code, label, category, kind, organization_id)
SELECT v.code, v.label, v.category, 'reject', 'ORG-01' FROM (VALUES
  ('REJ-DIM','Out of dimension tolerance','quality'),
  ('REJ-VIS','Visual defect','quality'),
  ('REJ-WGT','Weight out of spec','quality'),
  ('REJ-CON','Contamination found','quality')) v(code,label,category)
WHERE NOT EXISTS (SELECT 1 FROM public.waste_reasons w WHERE w.code = v.code);
