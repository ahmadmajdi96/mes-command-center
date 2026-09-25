
-- ===== Master data =====
CREATE TABLE public.work_centers (
  id text PRIMARY KEY, organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  name text NOT NULL, kind text NOT NULL DEFAULT 'line', line_id text, station_id text,
  erp_id text, mes_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.boms (
  id text PRIMARY KEY, organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  product_id text REFERENCES public.products(id), sku text NOT NULL, version text NOT NULL DEFAULT '1',
  base_qty numeric NOT NULL DEFAULT 1, uom text NOT NULL DEFAULT 'ea', status text NOT NULL DEFAULT 'active',
  erp_id text, mes_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  bom_id text NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'component' CHECK (item_type IN ('component','co_product','by_product')),
  component_product_id text, component_sku text NOT NULL, component_name text NOT NULL,
  qty numeric NOT NULL CHECK (qty >= 0), uom text NOT NULL DEFAULT 'ea',
  backflush boolean NOT NULL DEFAULT false, auto_confirm boolean NOT NULL DEFAULT false, sequence int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.routings (
  id text PRIMARY KEY, organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  product_id text REFERENCES public.products(id), sku text NOT NULL, version text NOT NULL DEFAULT '1',
  status text NOT NULL DEFAULT 'active', erp_id text, mes_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.routing_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  routing_id text NOT NULL REFERENCES public.routings(id) ON DELETE CASCADE,
  sequence int NOT NULL, name text NOT NULL, work_center_id text REFERENCES public.work_centers(id),
  setup_min numeric NOT NULL DEFAULT 0, run_min_per_unit numeric NOT NULL DEFAULT 0,
  work_instructions text, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.production_versions (
  id text PRIMARY KEY, organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  product_id text REFERENCES public.products(id), sku text NOT NULL, version text NOT NULL, description text,
  bom_id text REFERENCES public.boms(id), routing_id text REFERENCES public.routings(id),
  valid_from date, valid_to date, is_default boolean NOT NULL DEFAULT false,
  erp_id text, mes_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.erp_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  direction text NOT NULL DEFAULT 'inbound', entity text NOT NULL, erp_id text, action text NOT NULL,
  status text NOT NULL, message text, payload jsonb, created_at timestamptz NOT NULL DEFAULT now());

ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS production_version_id text REFERENCES public.production_versions(id),
  ADD COLUMN IF NOT EXISTS erp_id text,
  ADD COLUMN IF NOT EXISTS mes_override boolean NOT NULL DEFAULT false;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS erp_id text,
  ADD COLUMN IF NOT EXISTS mes_override boolean NOT NULL DEFAULT false;
ALTER TABLE public.production_batches ADD COLUMN IF NOT EXISTS erp_id text;

-- ===== Order-specific copies =====
CREATE TABLE public.order_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  production_order_id text NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  sequence int NOT NULL, name text NOT NULL, work_center_id text, work_instructions text,
  setup_min numeric NOT NULL DEFAULT 0, run_min_per_unit numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','skipped')),
  started_at timestamptz, completed_at timestamptz, started_by text, completed_by text,
  qty_yield numeric NOT NULL DEFAULT 0, qty_scrap numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.order_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  production_order_id text NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'component' CHECK (item_type IN ('component','co_product','by_product')),
  component_product_id text, component_sku text NOT NULL, component_name text NOT NULL,
  planned_qty numeric NOT NULL DEFAULT 0, uom text NOT NULL DEFAULT 'ea',
  backflush boolean NOT NULL DEFAULT false, auto_confirm boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now());

-- ===== Execution history (append-only) =====
CREATE TABLE public.production_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  production_order_id text NOT NULL REFERENCES public.production_orders(id) ON DELETE RESTRICT,
  batch_id text, operation_id uuid REFERENCES public.order_operations(id),
  qty_yield numeric NOT NULL DEFAULT 0 CHECK (qty_yield >= 0), qty_scrap numeric NOT NULL DEFAULT 0 CHECK (qty_scrap >= 0),
  scrap_reason text, final boolean NOT NULL DEFAULT false, post_goods_receipt boolean NOT NULL DEFAULT false,
  notes text, actor_user_id uuid, actor_name text, correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.material_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  production_order_id text NOT NULL REFERENCES public.production_orders(id) ON DELETE RESTRICT,
  batch_id text, operation_id uuid REFERENCES public.order_operations(id), confirmation_id uuid REFERENCES public.production_confirmations(id),
  component_sku text NOT NULL, component_name text NOT NULL, qty numeric NOT NULL, uom text NOT NULL DEFAULT 'ea',
  input_lot text, backflush boolean NOT NULL DEFAULT false, notes text,
  actor_user_id uuid, actor_name text, correlation_id text, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.activity_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  production_order_id text NOT NULL REFERENCES public.production_orders(id) ON DELETE RESTRICT,
  operation_id uuid REFERENCES public.order_operations(id),
  activity_type text NOT NULL CHECK (activity_type IN ('labor','machine','setup')),
  minutes numeric NOT NULL CHECK (minutes > 0), people int NOT NULL DEFAULT 1, notes text,
  actor_user_id uuid, actor_name text, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  production_order_id text NOT NULL REFERENCES public.production_orders(id) ON DELETE RESTRICT,
  batch_id text, confirmation_id uuid REFERENCES public.production_confirmations(id),
  receipt_type text NOT NULL CHECK (receipt_type IN ('finished','co_product','by_product')),
  sku text NOT NULL, name text NOT NULL, qty numeric NOT NULL, uom text NOT NULL DEFAULT 'ea',
  lot_number text, storage_location text, auto boolean NOT NULL DEFAULT false,
  actor_user_id uuid, actor_name text, created_at timestamptz NOT NULL DEFAULT now());

-- ===== Packing =====
CREATE TABLE public.packing_units (
  id text PRIMARY KEY, organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  production_order_id text REFERENCES public.production_orders(id), pack_type text NOT NULL DEFAULT 'carton',
  capacity numeric, status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','shipped')),
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.packing_unit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  packing_unit_id text NOT NULL REFERENCES public.packing_units(id) ON DELETE CASCADE,
  unit_uid text, batch_id text, qty numeric NOT NULL CHECK (qty > 0), partial boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now());

-- ===== Grants, RLS =====
DO $$
DECLARE t text; perm text;
BEGIN
  FOREACH t IN ARRAY ARRAY['work_centers','boms','bom_items','routings','routing_operations','production_versions','erp_sync_log',
    'order_operations','order_components','production_confirmations','material_consumptions','activity_confirmations',
    'goods_receipts','packing_units','packing_unit_items'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    perm := CASE
      WHEN t IN ('work_centers','boms','bom_items','routings','routing_operations','production_versions','erp_sync_log') THEN 'masterdata.write'
      WHEN t IN ('order_operations','order_components') THEN 'orders.write'
      ELSE 'execution.record' END;
    EXECUTE format('CREATE POLICY "org read" ON public.%I FOR SELECT TO authenticated USING (public.in_my_org(organization_id))', t);
    EXECUTE format('CREATE POLICY "org insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.in_my_org(organization_id) AND public.has_action(auth.uid(), %L))', t, perm);
    IF t NOT IN ('production_confirmations','material_consumptions','activity_confirmations','goods_receipts') THEN
      EXECUTE format('CREATE POLICY "org update" ON public.%I FOR UPDATE TO authenticated USING (public.in_my_org(organization_id) AND public.has_action(auth.uid(), %L)) WITH CHECK (public.in_my_org(organization_id))', t, perm);
      EXECUTE format('CREATE POLICY "org delete" ON public.%I FOR DELETE TO authenticated USING (public.in_my_org(organization_id) AND public.has_action(auth.uid(), %L))', t, perm);
    ELSE
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation()', t || '_append_only', t);
    END IF;
    IF t IN ('work_centers','boms','routings','production_versions','order_operations','packing_units') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_updated', t);
    END IF;
  END LOOP;
END $$;

CREATE INDEX ON public.order_operations(production_order_id);
CREATE INDEX ON public.order_components(production_order_id);
CREATE INDEX ON public.production_confirmations(production_order_id);
CREATE INDEX ON public.material_consumptions(production_order_id);
CREATE INDEX ON public.activity_confirmations(production_order_id);
CREATE INDEX ON public.goods_receipts(production_order_id);
CREATE INDEX ON public.goods_receipts(sku);
CREATE INDEX ON public.packing_unit_items(packing_unit_id);
CREATE UNIQUE INDEX packing_unit_items_one_open_uid ON public.packing_unit_items(unit_uid) WHERE unit_uid IS NOT NULL AND partial = false;

-- ===== Copy master data into an order (execution scenario) =====
CREATE OR REPLACE FUNCTION public.apply_production_version(_po_id text, _version_id text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE po record; pv record; bom record; factor numeric;
BEGIN
  SELECT * INTO po FROM production_orders WHERE id = _po_id;
  IF po IS NULL THEN RAISE EXCEPTION 'Order % not found', _po_id; END IF;
  IF po.status NOT IN ('scheduled','planned','released') THEN
    RAISE EXCEPTION 'The execution scenario can only be changed before the order starts (order is %)', po.status;
  END IF;
  SELECT * INTO pv FROM production_versions WHERE id = _version_id;
  IF pv IS NULL THEN RAISE EXCEPTION 'Production version % not found', _version_id; END IF;
  IF pv.sku <> po.sku THEN RAISE EXCEPTION 'Version % is for %, not %', pv.version, pv.sku, po.sku; END IF;
  IF EXISTS (SELECT 1 FROM production_confirmations WHERE production_order_id = _po_id) THEN
    RAISE EXCEPTION 'Order already has confirmations; its routing can no longer be replaced';
  END IF;
  DELETE FROM order_operations WHERE production_order_id = _po_id;
  DELETE FROM order_components WHERE production_order_id = _po_id;
  INSERT INTO order_operations (organization_id, production_order_id, sequence, name, work_center_id, work_instructions, setup_min, run_min_per_unit)
    SELECT po.organization_id, _po_id, sequence, name, work_center_id, work_instructions, setup_min, run_min_per_unit
    FROM routing_operations WHERE routing_id = pv.routing_id ORDER BY sequence;
  SELECT * INTO bom FROM boms WHERE id = pv.bom_id;
  IF bom IS NOT NULL THEN
    factor := po.qty / NULLIF(bom.base_qty, 0);
    INSERT INTO order_components (organization_id, production_order_id, item_type, component_product_id, component_sku, component_name, planned_qty, uom, backflush, auto_confirm)
      SELECT po.organization_id, _po_id, item_type, component_product_id, component_sku, component_name, round(qty * coalesce(factor,1), 4), uom, backflush, auto_confirm
      FROM bom_items WHERE bom_id = bom.id ORDER BY sequence;
  END IF;
  UPDATE production_orders SET production_version_id = _version_id WHERE id = _po_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_production_version(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.apply_production_version(text, text) TO authenticated;

-- ===== Automatic backflush + co/by-product confirmation =====
CREATE OR REPLACE FUNCTION public.auto_confirm_on_production()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE po record; c record; share numeric;
BEGIN
  SELECT * INTO po FROM production_orders WHERE id = NEW.production_order_id;
  share := (NEW.qty_yield + NEW.qty_scrap) / NULLIF(po.qty, 0);
  IF share IS NULL OR share <= 0 THEN RETURN NEW; END IF;
  FOR c IN SELECT * FROM order_components WHERE production_order_id = NEW.production_order_id LOOP
    IF c.item_type = 'component' AND c.backflush THEN
      INSERT INTO material_consumptions (organization_id, production_order_id, batch_id, operation_id, confirmation_id, component_sku, component_name, qty, uom, backflush, actor_user_id, actor_name, notes)
      VALUES (NEW.organization_id, NEW.production_order_id, NEW.batch_id, NEW.operation_id, NEW.id, c.component_sku, c.component_name, round(c.planned_qty * share, 4), c.uom, true, NEW.actor_user_id, NEW.actor_name, 'Automatic backflush');
    ELSIF c.item_type IN ('co_product','by_product') AND c.auto_confirm THEN
      INSERT INTO goods_receipts (organization_id, production_order_id, batch_id, confirmation_id, receipt_type, sku, name, qty, uom, lot_number, auto, actor_user_id, actor_name)
      VALUES (NEW.organization_id, NEW.production_order_id, NEW.batch_id, NEW.id, c.item_type, c.component_sku, c.component_name, round(c.planned_qty * share, 4), c.uom, po.lot_number, true, NEW.actor_user_id, NEW.actor_name);
    END IF;
  END LOOP;
  IF NEW.post_goods_receipt AND NEW.qty_yield > 0 THEN
    INSERT INTO goods_receipts (organization_id, production_order_id, batch_id, confirmation_id, receipt_type, sku, name, qty, uom, lot_number, auto, actor_user_id, actor_name)
    VALUES (NEW.organization_id, NEW.production_order_id, NEW.batch_id, NEW.id, 'finished', po.sku, po.product_name, NEW.qty_yield, po.uom, po.lot_number, true, NEW.actor_user_id, NEW.actor_name);
  END IF;
  IF NEW.operation_id IS NOT NULL THEN
    UPDATE order_operations SET qty_yield = qty_yield + NEW.qty_yield, qty_scrap = qty_scrap + NEW.qty_scrap,
      status = CASE WHEN NEW.final THEN 'completed' ELSE CASE WHEN status = 'pending' THEN 'running' ELSE status END END,
      started_at = coalesce(started_at, now()), completed_at = CASE WHEN NEW.final THEN now() ELSE completed_at END,
      completed_by = CASE WHEN NEW.final THEN NEW.actor_name ELSE completed_by END
    WHERE id = NEW.operation_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.auto_confirm_on_production() FROM anon, authenticated, public;
CREATE TRIGGER production_confirmations_auto AFTER INSERT ON public.production_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_on_production();

-- Stock on hand from receipts minus consumption (respecting the caller's company via RLS on base tables)
CREATE VIEW public.stock_on_hand WITH (security_invoker = true) AS
  SELECT organization_id, sku, max(name) AS name, max(uom) AS uom, sum(qty) AS qty
  FROM (
    SELECT organization_id, sku, name, uom, qty FROM public.goods_receipts
    UNION ALL
    SELECT organization_id, component_sku, component_name, uom, -qty FROM public.material_consumptions
  ) x GROUP BY organization_id, sku;
GRANT SELECT ON public.stock_on_hand TO authenticated;
