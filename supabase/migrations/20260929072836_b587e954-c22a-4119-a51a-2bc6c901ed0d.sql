CREATE OR REPLACE FUNCTION public.portal_emit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE j jsonb := to_jsonb(NEW); o jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
BEGIN
  IF TG_TABLE_NAME = 'station_holds' THEN
    IF TG_OP = 'INSERT' AND j->>'hold_type' IN ('qc','maintenance') THEN
      PERFORM enqueue_portal_event(j->>'organization_id', CASE WHEN j->>'hold_type' = 'qc' THEN 'qa' ELSE 'maintenance' END, 'hold_placed', 'station_holds', j->>'id',
        jsonb_build_object('station_hold_id', j->'id', 'station_id', j->'station_id', 'reason', j->'reason', 'opened_by', j->'opened_by_name', 'opened_at', j->'opened_at'));
    END IF;
  ELSIF TG_TABLE_NAME = 'production_exceptions' THEN
    IF j->>'exception_type' IN ('machine_failure','tool_failure') THEN
      PERFORM enqueue_portal_event(j->>'organization_id', 'maintenance', 'equipment_fault', 'production_exceptions', j->>'id', j);
    ELSIF j->>'exception_type' IN ('quality_interruption','process_deviation') THEN
      PERFORM enqueue_portal_event(j->>'organization_id', 'qa', 'quality_issue', 'production_exceptions', j->>'id', j);
    END IF;
  ELSIF TG_TABLE_NAME = 'rework_tasks' THEN
    IF j->>'status' = 'awaiting_inspection' AND (TG_OP = 'INSERT' OR o->>'status' IS DISTINCT FROM j->>'status') THEN
      PERFORM enqueue_portal_event(j->>'organization_id', 'qa', 'inspection_requested', 'rework_tasks', j->>'id',
        jsonb_build_object('rework_task_id', j->'id', 'production_order_id', j->'production_order_id', 'batch_id', j->'batch_id', 'qty', j->'qty', 'uom', j->'uom', 'reason', j->'reason', 'attempt', j->'attempts'));
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.portal_emit() FROM PUBLIC, anon, authenticated;