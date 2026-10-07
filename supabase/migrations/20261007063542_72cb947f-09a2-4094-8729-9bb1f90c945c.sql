CREATE OR REPLACE FUNCTION public.guard_master_lines() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE st text; pid text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_TABLE_NAME = 'bom_items' THEN
    pid := COALESCE(NEW.bom_id, OLD.bom_id); SELECT status INTO st FROM boms WHERE id = pid;
  ELSE
    pid := COALESCE(NEW.routing_id, OLD.routing_id); SELECT status INTO st FROM routings WHERE id = pid;
  END IF;
  IF st = 'active' THEN
    RAISE EXCEPTION '% is active and locked. Make a new version, change it, then activate it', pid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_guard_bom_items BEFORE INSERT OR UPDATE OR DELETE ON public.bom_items FOR EACH ROW EXECUTE FUNCTION public.guard_master_lines();
CREATE TRIGGER trg_guard_routing_ops BEFORE INSERT OR UPDATE OR DELETE ON public.routing_operations FOR EACH ROW EXECUTE FUNCTION public.guard_master_lines();

CREATE OR REPLACE FUNCTION public.guard_master_header() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE used text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT string_agg(id, ', ') INTO used FROM production_versions WHERE (TG_TABLE_NAME = 'boms' AND bom_id = OLD.id) OR (TG_TABLE_NAME = 'routings' AND routing_id = OLD.id);
    IF used IS NOT NULL THEN RAISE EXCEPTION '% is in use by production version(s): %. Remove it there first', OLD.id, used; END IF;
    RETURN OLD;
  END IF;
  IF auth.uid() IS NOT NULL AND NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF NOT public.has_action(auth.uid(), 'recipes.publish') THEN
      RAISE EXCEPTION 'You are not allowed to activate versions (needs the "publish recipes" permission)';
    END IF;
  END IF;
  IF auth.uid() IS NOT NULL AND OLD.status = 'active' AND NEW.status = 'active'
     AND (NEW.base_qty IS DISTINCT FROM OLD.base_qty OR NEW.sku IS DISTINCT FROM OLD.sku OR NEW.version IS DISTINCT FROM OLD.version) THEN
    RAISE EXCEPTION '% is active and locked. Make a new version to change it', NEW.id;
  END IF;
  RETURN NEW;
END $$;

-- routings have no base_qty; use a separate header guard for them
CREATE OR REPLACE FUNCTION public.guard_routing_header() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE used text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT string_agg(id, ', ') INTO used FROM production_versions WHERE routing_id = OLD.id;
    IF used IS NOT NULL THEN RAISE EXCEPTION '% is in use by production version(s): %. Remove it there first', OLD.id, used; END IF;
    RETURN OLD;
  END IF;
  IF auth.uid() IS NOT NULL AND NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active'
     AND NOT public.has_action(auth.uid(), 'recipes.publish') THEN
    RAISE EXCEPTION 'You are not allowed to activate versions (needs the "publish recipes" permission)';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_boms BEFORE UPDATE OR DELETE ON public.boms FOR EACH ROW EXECUTE FUNCTION public.guard_master_header();
CREATE TRIGGER trg_guard_routings BEFORE UPDATE OR DELETE ON public.routings FOR EACH ROW EXECUTE FUNCTION public.guard_routing_header();

CREATE OR REPLACE FUNCTION public.retire_previous_version() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF TG_TABLE_NAME = 'boms' THEN
      UPDATE boms SET status = 'superseded' WHERE sku = NEW.sku AND organization_id = NEW.organization_id AND id <> NEW.id AND status = 'active';
    ELSE
      UPDATE routings SET status = 'superseded' WHERE sku = NEW.sku AND organization_id = NEW.organization_id AND id <> NEW.id AND status = 'active';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_retire_boms AFTER UPDATE ON public.boms FOR EACH ROW EXECUTE FUNCTION public.retire_previous_version();
CREATE TRIGGER trg_retire_routings AFTER UPDATE ON public.routings FOR EACH ROW EXECUTE FUNCTION public.retire_previous_version();

CREATE OR REPLACE FUNCTION public.new_master_version(_kind text, _id text) RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE src record; nv int; nid text;
BEGIN
  IF _kind = 'bom' THEN
    SELECT * INTO src FROM boms WHERE id = _id;
    IF NOT FOUND THEN RAISE EXCEPTION 'BOM not found'; END IF;
    SELECT COALESCE(max(NULLIF(regexp_replace(version, '\D', '', 'g'), '')::int), 0) + 1 INTO nv FROM boms WHERE sku = src.sku AND organization_id = src.organization_id;
    nid := regexp_replace(_id, '-v\d+$', '') || '-v' || nv;
    INSERT INTO boms (id, organization_id, product_id, sku, version, base_qty, uom, status)
      VALUES (nid, src.organization_id, src.product_id, src.sku, nv::text, src.base_qty, src.uom, 'draft');
    INSERT INTO bom_items (organization_id, bom_id, item_type, component_product_id, component_sku, component_name, qty, uom, backflush, auto_confirm, sequence)
      SELECT organization_id, nid, item_type, component_product_id, component_sku, component_name, qty, uom, backflush, auto_confirm, sequence FROM bom_items WHERE bom_id = _id;
  ELSIF _kind = 'routing' THEN
    SELECT * INTO src FROM routings WHERE id = _id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Routing not found'; END IF;
    SELECT COALESCE(max(NULLIF(regexp_replace(version, '\D', '', 'g'), '')::int), 0) + 1 INTO nv FROM routings WHERE sku = src.sku AND organization_id = src.organization_id;
    nid := regexp_replace(_id, '-v\d+$', '') || '-v' || nv;
    INSERT INTO routings (id, organization_id, product_id, sku, version, status)
      VALUES (nid, src.organization_id, src.product_id, src.sku, nv::text, 'draft');
    INSERT INTO routing_operations (organization_id, routing_id, sequence, name, work_center_id, setup_min, run_min_per_unit, work_instructions, requires_approval, required_fields)
      SELECT organization_id, nid, sequence, name, work_center_id, setup_min, run_min_per_unit, work_instructions, requires_approval, required_fields FROM routing_operations WHERE routing_id = _id;
  ELSE RAISE EXCEPTION 'Unknown kind';
  END IF;
  RETURN nid;
END $$;
REVOKE EXECUTE ON FUNCTION public.new_master_version(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.new_master_version(text, text) TO authenticated;