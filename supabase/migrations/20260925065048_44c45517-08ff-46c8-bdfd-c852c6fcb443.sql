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
  INSERT INTO order_operations (organization_id, production_order_id, sequence, name, work_center_id, work_instructions, setup_min, run_min_per_unit)
    SELECT po.organization_id, _po_id, sequence, name, work_center_id, work_instructions, setup_min, run_min_per_unit
    FROM routing_operations WHERE routing_id = pv.routing_id ORDER BY sequence;
  SELECT * INTO bom FROM boms WHERE id = pv.bom_id;
  IF FOUND THEN
    factor := po.qty / NULLIF(bom.base_qty, 0);
    INSERT INTO order_components (organization_id, production_order_id, item_type, component_product_id, component_sku, component_name, planned_qty, uom, backflush, auto_confirm)
      SELECT po.organization_id, _po_id, item_type, component_product_id, component_sku, component_name, round(qty * coalesce(factor,1), 4), uom, backflush, auto_confirm
      FROM bom_items WHERE bom_id = bom.id ORDER BY sequence;
  END IF;
  UPDATE production_orders SET production_version_id = _version_id WHERE id = _po_id;
END $$;