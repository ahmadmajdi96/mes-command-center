CREATE OR REPLACE FUNCTION public.inspection_after_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; po record; r record; v numeric; hit boolean; nc_id text;
BEGIN
  SELECT * INTO o FROM order_operations WHERE id = NEW.operation_id;
  SELECT * INTO po FROM production_orders WHERE id = NEW.production_order_id;
  IF NEW.result = 'fail' THEN
    INSERT INTO nonconformances (organization_id, production_order_id, operation_id, inspection_result_id, batch_id, qty, uom, severity, description, raised_by_name, raised_by_user_id)
    VALUES (NEW.organization_id, NEW.production_order_id, NEW.operation_id, NEW.id, NEW.batch_id, greatest(coalesce(o.qty_input,0) - coalesce(o.qty_processed,0), coalesce(o.qty_input,0)), po.uom, 'major',
      format('Inspection failed at "%s" (sample %s): %s', o.name, NEW.sample_no, coalesce(nullif(array_to_string(NEW.failed_checks, ', '), ''), 'failed')),
      coalesce(NEW.inspector_name, 'Inspection'), NEW.actor_user_id)
    RETURNING id INTO nc_id;
  END IF;
  FOR r IN SELECT * FROM routing_rules WHERE organization_id = NEW.organization_id AND active
      AND trigger_kind IN ('inspection_fail','value_out_of_range')
      AND (operation_name IS NULL OR lower(operation_name) = lower(o.name))
      AND (product_id IS NULL OR product_id = po.product_id) ORDER BY priority LOOP
    hit := false; v := NULL;
    IF r.trigger_kind = 'inspection_fail' THEN hit := NEW.result = 'fail';
    ELSE
      BEGIN v := (NEW."values"->>r.parameter)::numeric; EXCEPTION WHEN others THEN v := NULL; END;
      hit := v IS NOT NULL AND ((r.min_value IS NOT NULL AND v < r.min_value) OR (r.max_value IS NOT NULL AND v > r.max_value));
    END IF;
    CONTINUE WHEN NOT hit;
    IF r.action = 'rework_step' AND o.status IN ('running','partially_completed','completed') THEN
      UPDATE order_operations SET status = 'rework_required', status_reason = 'Routing rule: ' || r.name WHERE id = o.id;
    ELSIF r.action = 'hold_step' AND o.status IN ('running','partially_completed') THEN
      UPDATE order_operations SET status = 'on_hold', hold_category = 'quality', status_reason = 'Routing rule: ' || r.name WHERE id = o.id;
    ELSIF r.action = 'skip_step' THEN
      UPDATE order_operations SET status = 'skipped', status_reason = 'Routing rule: ' || r.name
        WHERE production_order_id = po.id AND lower(name) = lower(r.target_operation_name) AND status IN ('pending','ready');
    END IF;
    INSERT INTO routing_rule_hits (organization_id, rule_id, production_order_id, operation_id, action, detail)
    VALUES (NEW.organization_id, r.id, po.id, o.id, r.action, format('%s at "%s"%s', r.trigger_kind, o.name, CASE WHEN v IS NOT NULL THEN ' value ' || v ELSE '' END));
    EXIT;
  END LOOP;
  RETURN NEW;
END $$;