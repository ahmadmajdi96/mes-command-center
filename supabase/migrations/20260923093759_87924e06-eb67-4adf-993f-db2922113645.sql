DO $$
DECLARE
  t text;
  p record;
  tables text[] := ARRAY[
    'products','production_orders','production_batches','product_units','unit_events','unit_readings',
    'product_station_recipes','waste_events','waste_reasons','station_waste_reasons','station_holds',
    'lines','stations','work_orders','downtime_events','quality_holds','genealogy_records',
    'mes_users','audit_entries'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- ===== Master data =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
CREATE POLICY "read products" ON public.products FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'masterdata.read'));
CREATE POLICY "write products" ON public.products FOR ALL TO authenticated
  USING (public.has_action(auth.uid(),'masterdata.write')) WITH CHECK (public.has_action(auth.uid(),'masterdata.write'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_reasons TO authenticated;
CREATE POLICY "read waste_reasons" ON public.waste_reasons FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'masterdata.read'));
CREATE POLICY "write waste_reasons" ON public.waste_reasons FOR ALL TO authenticated
  USING (public.has_action(auth.uid(),'masterdata.write')) WITH CHECK (public.has_action(auth.uid(),'masterdata.write'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.station_waste_reasons TO authenticated;
CREATE POLICY "read station_waste_reasons" ON public.station_waste_reasons FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'masterdata.read'));
CREATE POLICY "write station_waste_reasons" ON public.station_waste_reasons FOR ALL TO authenticated
  USING (public.has_action(auth.uid(),'masterdata.write')) WITH CHECK (public.has_action(auth.uid(),'masterdata.write'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_station_recipes TO authenticated;
CREATE POLICY "read recipes" ON public.product_station_recipes FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'masterdata.read'));
CREATE POLICY "write recipes" ON public.product_station_recipes FOR ALL TO authenticated
  USING (public.has_action(auth.uid(),'recipes.write')) WITH CHECK (public.has_action(auth.uid(),'recipes.write'));

-- ===== Orders / batches =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_orders TO authenticated;
CREATE POLICY "read orders" ON public.production_orders FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'orders.read'));
CREATE POLICY "write orders" ON public.production_orders FOR ALL TO authenticated
  USING (public.has_action(auth.uid(),'orders.write')) WITH CHECK (public.has_action(auth.uid(),'orders.write'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_batches TO authenticated;
CREATE POLICY "read batches" ON public.production_batches FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'orders.read'));
CREATE POLICY "write batches" ON public.production_batches FOR ALL TO authenticated
  USING (public.has_action(auth.uid(),'orders.write')) WITH CHECK (public.has_action(auth.uid(),'orders.write'));

-- ===== Execution =====
GRANT SELECT, INSERT, UPDATE ON public.product_units TO authenticated;
CREATE POLICY "read units" ON public.product_units FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'execution.read'));
CREATE POLICY "create units" ON public.product_units FOR INSERT TO authenticated WITH CHECK (public.has_action(auth.uid(),'execution.record') OR public.has_action(auth.uid(),'orders.write'));
CREATE POLICY "advance units" ON public.product_units FOR UPDATE TO authenticated
  USING (public.has_action(auth.uid(),'execution.record')) WITH CHECK (public.has_action(auth.uid(),'execution.record'));

GRANT SELECT, INSERT ON public.unit_events TO authenticated;
CREATE POLICY "read unit_events" ON public.unit_events FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'execution.read'));
CREATE POLICY "append unit_events" ON public.unit_events FOR INSERT TO authenticated WITH CHECK (public.has_action(auth.uid(),'execution.record'));

GRANT SELECT, INSERT ON public.unit_readings TO authenticated;
CREATE POLICY "read unit_readings" ON public.unit_readings FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'execution.read'));
CREATE POLICY "append unit_readings" ON public.unit_readings FOR INSERT TO authenticated WITH CHECK (public.has_action(auth.uid(),'execution.record'));

GRANT SELECT, INSERT ON public.waste_events TO authenticated;
CREATE POLICY "read waste_events" ON public.waste_events FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'execution.read'));
CREATE POLICY "append waste_events" ON public.waste_events FOR INSERT TO authenticated WITH CHECK (public.has_action(auth.uid(),'execution.record'));

GRANT SELECT, INSERT ON public.genealogy_records TO authenticated;
CREATE POLICY "read genealogy" ON public.genealogy_records FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'execution.read'));
CREATE POLICY "append genealogy" ON public.genealogy_records FOR INSERT TO authenticated WITH CHECK (public.has_action(auth.uid(),'execution.record'));

-- ===== Holds =====
GRANT SELECT, INSERT, UPDATE ON public.station_holds TO authenticated;
CREATE POLICY "read station_holds" ON public.station_holds FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'execution.read'));
CREATE POLICY "raise station_holds" ON public.station_holds FOR INSERT TO authenticated WITH CHECK (public.has_action(auth.uid(),'holds.raise'));
CREATE POLICY "clear station_holds" ON public.station_holds FOR UPDATE TO authenticated
  USING (
    (hold_type = 'quality' AND public.has_action(auth.uid(),'holds.release'))
    OR (hold_type <> 'quality' AND (public.has_action(auth.uid(),'maintenance.clear') OR public.has_action(auth.uid(),'holds.release')))
  )
  WITH CHECK (
    (hold_type = 'quality' AND public.has_action(auth.uid(),'holds.release'))
    OR (hold_type <> 'quality' AND (public.has_action(auth.uid(),'maintenance.clear') OR public.has_action(auth.uid(),'holds.release')))
  );

GRANT SELECT, INSERT, UPDATE ON public.quality_holds TO authenticated;
CREATE POLICY "read quality_holds" ON public.quality_holds FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'execution.read'));
CREATE POLICY "raise quality_holds" ON public.quality_holds FOR INSERT TO authenticated WITH CHECK (public.has_action(auth.uid(),'holds.raise'));
CREATE POLICY "release quality_holds" ON public.quality_holds FOR UPDATE TO authenticated
  USING (public.has_action(auth.uid(),'holds.release')) WITH CHECK (public.has_action(auth.uid(),'holds.release'));

-- ===== Downtime =====
GRANT SELECT, INSERT, UPDATE ON public.downtime_events TO authenticated;
CREATE POLICY "read downtime" ON public.downtime_events FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'execution.read'));
CREATE POLICY "record downtime" ON public.downtime_events FOR INSERT TO authenticated WITH CHECK (public.has_action(auth.uid(),'downtime.record'));
CREATE POLICY "resolve downtime" ON public.downtime_events FOR UPDATE TO authenticated
  USING (public.has_action(auth.uid(),'downtime.record')) WITH CHECK (public.has_action(auth.uid(),'downtime.record'));

-- ===== Assets =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lines TO authenticated;
CREATE POLICY "read lines" ON public.lines FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'execution.read'));
CREATE POLICY "configure lines" ON public.lines FOR ALL TO authenticated
  USING (public.has_action(auth.uid(),'masterdata.write')) WITH CHECK (public.has_action(auth.uid(),'masterdata.write'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stations TO authenticated;
CREATE POLICY "read stations" ON public.stations FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'execution.read'));
CREATE POLICY "configure stations" ON public.stations FOR ALL TO authenticated
  USING (public.has_action(auth.uid(),'masterdata.write')) WITH CHECK (public.has_action(auth.uid(),'masterdata.write'));
CREATE POLICY "operate stations" ON public.stations FOR UPDATE TO authenticated
  USING (public.has_action(auth.uid(),'execution.record')) WITH CHECK (public.has_action(auth.uid(),'execution.record'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
CREATE POLICY "read work_orders" ON public.work_orders FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'orders.read'));
CREATE POLICY "write work_orders" ON public.work_orders FOR ALL TO authenticated
  USING (public.has_action(auth.uid(),'orders.write')) WITH CHECK (public.has_action(auth.uid(),'orders.write'));
CREATE POLICY "progress work_orders" ON public.work_orders FOR UPDATE TO authenticated
  USING (public.has_action(auth.uid(),'execution.record')) WITH CHECK (public.has_action(auth.uid(),'execution.record'));

-- ===== Workforce =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mes_users TO authenticated;
CREATE POLICY "read mes_users" ON public.mes_users FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'execution.read'));
CREATE POLICY "admin mes_users" ON public.mes_users FOR ALL TO authenticated
  USING (public.can_admin_users(auth.uid())) WITH CHECK (public.can_admin_users(auth.uid()));

-- ===== Audit =====
GRANT SELECT, INSERT ON public.audit_entries TO authenticated;
CREATE POLICY "read audit" ON public.audit_entries FOR SELECT TO authenticated USING (public.has_action(auth.uid(),'reports.read'));
CREATE POLICY "append audit" ON public.audit_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
