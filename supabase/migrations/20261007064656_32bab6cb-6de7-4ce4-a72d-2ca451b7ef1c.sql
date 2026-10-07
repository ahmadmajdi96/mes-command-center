CREATE OR REPLACE FUNCTION private.notify_andon_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.notify_users(NEW.organization_id,
    'execution.record',
    'andon',
    'Andon call: ' || NEW.kind || COALESCE(' at ' || NEW.station_id, ''),
    COALESCE(NEW.message, 'Help requested'),
    '/downtime',
    'high',
    NEW.created_by);
  RETURN NEW;
END;
$$;