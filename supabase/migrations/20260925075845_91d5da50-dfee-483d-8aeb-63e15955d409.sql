CREATE OR REPLACE FUNCTION public.auto_confirm_on_production()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE po record; c record; share numeric; is_last boolean;
BEGIN
  SELECT * INTO po FROM production_orders WHERE id = NEW.production_order_id;
  share := (NEW.qty_yield + NEW.qty_scrap) / NULLIF(po.qty, 0);
  -- Materials/by-products are posted once per order: on the last operation (or order-level confirmations).
  is_last := NEW.operation_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM order_operations o2, order_operations o1
    WHERE o1.id = NEW.operation_id AND o2.production_order_id = o1.production_order_id AND o2.sequence > o1.sequence);
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
END $function$;