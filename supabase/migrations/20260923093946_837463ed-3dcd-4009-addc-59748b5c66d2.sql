CREATE OR REPLACE FUNCTION public.guard_unit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'unit_events is append-only; production history cannot be deleted';
  END IF;

  IF OLD.exited_at IS NOT NULL THEN
    RAISE EXCEPTION 'This station visit is already closed and cannot be modified; record a linked correction event instead';
  END IF;

  IF NEW.unit_uid <> OLD.unit_uid
     OR COALESCE(NEW.station_id,'') <> COALESCE(OLD.station_id,'')
     OR COALESCE(NEW.entered_at, OLD.entered_at) <> OLD.entered_at
     OR COALESCE(NEW.operator_id,'') <> COALESCE(OLD.operator_id,'')
     OR COALESCE(NEW.actor_user_id::text,'') <> COALESCE(OLD.actor_user_id::text,'')
     OR NEW.at <> OLD.at THEN
    RAISE EXCEPTION 'Only the exit of an open station visit may be recorded; identity and entry data are immutable';
  END IF;

  IF NEW.exited_at IS NULL THEN
    RAISE EXCEPTION 'Closing a station visit requires an exit timestamp';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_unit_event_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS unit_events_append_only ON public.unit_events;
CREATE TRIGGER unit_events_guard BEFORE UPDATE OR DELETE ON public.unit_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_unit_event_mutation();

GRANT UPDATE ON public.unit_events TO authenticated;
DROP POLICY IF EXISTS "close unit_events" ON public.unit_events;
CREATE POLICY "close unit_events" ON public.unit_events FOR UPDATE TO authenticated
  USING (public.has_action(auth.uid(),'execution.record'))
  WITH CHECK (public.has_action(auth.uid(),'execution.record'));
