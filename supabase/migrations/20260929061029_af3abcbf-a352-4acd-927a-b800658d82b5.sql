CREATE OR REPLACE FUNCTION public.consume_from_lot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE l record;
BEGIN
  IF NEW.lot_id IS NULL AND NEW.input_lot IS NOT NULL THEN
    SELECT id INTO NEW.lot_id FROM material_lots WHERE organization_id = NEW.organization_id AND sku = NEW.component_sku AND lot_number = NEW.input_lot;
    IF NEW.lot_id IS NULL AND NOT NEW.backflush THEN RAISE EXCEPTION 'Lot % was not found for material %', NEW.input_lot, NEW.component_sku; END IF;
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
REVOKE EXECUTE ON FUNCTION public.consume_from_lot() FROM PUBLIC, anon, authenticated;