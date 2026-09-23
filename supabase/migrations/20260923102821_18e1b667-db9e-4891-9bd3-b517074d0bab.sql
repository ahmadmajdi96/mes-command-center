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
    WHEN 'scheduled' THEN ARRAY['planned','released','cancelled']
    WHEN 'planned'   THEN ARRAY['scheduled','released','cancelled']
    WHEN 'released'  THEN ARRAY['scheduled','planned','running','cancelled']
    WHEN 'running'   THEN ARRAY['paused','hold','completed','finished','cancelled']
    WHEN 'paused'    THEN ARRAY['running','hold','cancelled']
    WHEN 'hold'      THEN ARRAY['running','paused','cancelled']
    WHEN 'completed' THEN ARRAY['closed']
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
    IF NEW.status IN ('completed','finished','closed') AND EXISTS (
      SELECT 1 FROM public.production_batches b
      WHERE b.production_order_id = NEW.id
        AND b.status NOT IN ('completed','finished','closed','cancelled')
    ) THEN
      RAISE EXCEPTION 'This order still has batches that are not completed or cancelled';
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
    IF NEW.status IN ('completed','finished','closed') THEN
      IF EXISTS (
        SELECT 1 FROM public.unit_events e
        JOIN public.product_units u ON u.uid = e.unit_uid
        WHERE u.batch_id = NEW.id AND e.exited_at IS NULL AND e.entered_at IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Some items of this batch are still open at a station';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.product_units u
        WHERE u.batch_id = NEW.id AND u.status IN ('in_process','created','rework')
      ) THEN
        RAISE EXCEPTION 'Some items of this batch have not been completed, scrapped or rejected yet';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;