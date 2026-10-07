CREATE OR REPLACE FUNCTION public.guard_lot_expiry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE l record;
BEGIN
  SELECT lot_number, expiry_date, status INTO l FROM material_lots
   WHERE (NEW.lot_id IS NOT NULL AND id = NEW.lot_id)
      OR (NEW.lot_id IS NULL AND NEW.input_lot IS NOT NULL AND organization_id = NEW.organization_id AND sku = NEW.component_sku AND lot_number = NEW.input_lot)
   LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF l.expiry_date IS NOT NULL AND l.expiry_date < current_date THEN
    RAISE EXCEPTION 'Lot % expired on % and cannot be used', l.lot_number, l.expiry_date;
  END IF;
  IF l.status IN ('blocked','quarantine','expired','recalled') THEN
    RAISE EXCEPTION 'Lot % is % and cannot be used', l.lot_number, l.status;
  END IF;
  RETURN NEW;
END $$;