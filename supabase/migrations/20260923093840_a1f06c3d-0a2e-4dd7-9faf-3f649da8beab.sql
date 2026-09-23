-- ===== Correction linkage + real actor on audit =====
ALTER TABLE public.unit_events ADD COLUMN IF NOT EXISTS corrects_event_id text;
ALTER TABLE public.unit_events ADD COLUMN IF NOT EXISTS correction_reason text;
ALTER TABLE public.unit_events ADD COLUMN IF NOT EXISTS actor_user_id uuid;
ALTER TABLE public.unit_events ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE public.unit_events ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE public.unit_events ADD COLUMN IF NOT EXISTS correlation_id text;

ALTER TABLE public.unit_readings ADD COLUMN IF NOT EXISTS corrects_reading_id uuid;
ALTER TABLE public.unit_readings ADD COLUMN IF NOT EXISTS correction_reason text;
ALTER TABLE public.unit_readings ADD COLUMN IF NOT EXISTS actor_user_id uuid;
ALTER TABLE public.unit_readings ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE public.unit_readings ADD COLUMN IF NOT EXISTS correlation_id text;

ALTER TABLE public.waste_events ADD COLUMN IF NOT EXISTS actor_user_id uuid;
ALTER TABLE public.waste_events ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE public.waste_events ADD COLUMN IF NOT EXISTS correlation_id text;

ALTER TABLE public.audit_entries ADD COLUMN IF NOT EXISTS actor_user_id uuid;
ALTER TABLE public.audit_entries ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE public.audit_entries ADD COLUMN IF NOT EXISTS correlation_id text;
ALTER TABLE public.audit_entries ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.audit_entries ADD COLUMN IF NOT EXISTS device_id text;

ALTER TABLE public.station_holds ADD COLUMN IF NOT EXISTS opened_by_user_id uuid;
ALTER TABLE public.station_holds ADD COLUMN IF NOT EXISTS closed_by_user_id uuid;

-- ===== Append-only enforcement =====
CREATE OR REPLACE FUNCTION public.reject_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Table %.% is append-only; record a linked correction entry instead of editing or deleting history',
    TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_history_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS unit_events_append_only ON public.unit_events;
CREATE TRIGGER unit_events_append_only BEFORE UPDATE OR DELETE ON public.unit_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

DROP TRIGGER IF EXISTS unit_readings_append_only ON public.unit_readings;
CREATE TRIGGER unit_readings_append_only BEFORE UPDATE OR DELETE ON public.unit_readings
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

DROP TRIGGER IF EXISTS waste_events_append_only ON public.waste_events;
CREATE TRIGGER waste_events_append_only BEFORE UPDATE OR DELETE ON public.waste_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

DROP TRIGGER IF EXISTS audit_entries_append_only ON public.audit_entries;
CREATE TRIGGER audit_entries_append_only BEFORE UPDATE OR DELETE ON public.audit_entries
  FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

-- ===== History survives master-data deletion =====
ALTER TABLE public.product_units DROP CONSTRAINT IF EXISTS product_units_production_order_id_fkey;
ALTER TABLE public.product_units
  ADD CONSTRAINT product_units_production_order_id_fkey
  FOREIGN KEY (production_order_id) REFERENCES public.production_orders(id) ON DELETE RESTRICT;

ALTER TABLE public.product_units DROP CONSTRAINT IF EXISTS product_units_batch_id_fkey;
ALTER TABLE public.product_units
  ADD CONSTRAINT product_units_batch_id_fkey
  FOREIGN KEY (batch_id) REFERENCES public.production_batches(id) ON DELETE RESTRICT;

ALTER TABLE public.unit_events DROP CONSTRAINT IF EXISTS unit_events_unit_uid_fkey;
ALTER TABLE public.unit_events
  ADD CONSTRAINT unit_events_unit_uid_fkey
  FOREIGN KEY (unit_uid) REFERENCES public.product_units(uid) ON DELETE RESTRICT;

ALTER TABLE public.production_batches DROP CONSTRAINT IF EXISTS production_batches_production_order_id_fkey;
ALTER TABLE public.production_batches
  ADD CONSTRAINT production_batches_production_order_id_fkey
  FOREIGN KEY (production_order_id) REFERENCES public.production_orders(id) ON DELETE RESTRICT;

-- ===== Progress rollup: handle deletes and parent reassignment =====
CREATE OR REPLACE FUNCTION public.recalc_batch_and_order_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  b text;
  o text;
BEGIN
  FOREACH b IN ARRAY ARRAY[NEW.batch_id, OLD.batch_id] LOOP
    IF b IS NOT NULL THEN
      UPDATE public.production_batches pb
      SET qty_produced = (SELECT count(*) FROM public.product_units u WHERE u.batch_id = b AND u.status = 'completed')
      WHERE pb.id = b;
    END IF;
  END LOOP;

  FOREACH o IN ARRAY ARRAY[NEW.production_order_id, OLD.production_order_id] LOOP
    IF o IS NOT NULL THEN
      UPDATE public.production_orders po
      SET qty_produced = (SELECT count(*) FROM public.product_units u WHERE u.production_order_id = o AND u.status = 'completed')
      WHERE po.id = o;
    END IF;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.recalc_batch_and_order_progress() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_units_progress ON public.product_units;
CREATE TRIGGER trg_units_progress AFTER INSERT OR UPDATE OR DELETE ON public.product_units
  FOR EACH ROW EXECUTE FUNCTION public.recalc_batch_and_order_progress();

-- ===== Evidence bucket: server-mediated access only =====
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "service role manages evidence" ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'mes-evidence') WITH CHECK (bucket_id = 'mes-evidence');
