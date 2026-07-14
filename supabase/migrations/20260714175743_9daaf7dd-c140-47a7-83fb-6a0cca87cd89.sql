
-- 1. Stations: allow semi_auto + operation modes config
ALTER TABLE public.stations DROP CONSTRAINT IF EXISTS stations_type_check;
ALTER TABLE public.stations ADD CONSTRAINT stations_type_check
  CHECK (type = ANY (ARRAY['manual','automatic','semi_auto']));
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS operation_modes jsonb DEFAULT '{"auto": true, "manual": true}'::jsonb;
ALTER TABLE public.stations ADD COLUMN IF NOT EXISTS current_mode text DEFAULT 'auto' CHECK (current_mode IN ('auto','manual'));

-- 2. Product station recipes (per product + station variable schema)
CREATE TABLE public.product_station_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  station_id text NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 0,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_cycle_sec integer,
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, station_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_station_recipes TO authenticated, anon;
GRANT ALL ON public.product_station_recipes TO service_role;
ALTER TABLE public.product_station_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public recipes all" ON public.product_station_recipes USING (true) WITH CHECK (true);
CREATE TRIGGER trg_recipes_updated_at BEFORE UPDATE ON public.product_station_recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Waste reason catalog (global)
CREATE TABLE public.waste_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_reasons TO authenticated, anon;
GRANT ALL ON public.waste_reasons TO service_role;
ALTER TABLE public.waste_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public waste_reasons all" ON public.waste_reasons USING (true) WITH CHECK (true);
CREATE TRIGGER trg_waste_reasons_updated_at BEFORE UPDATE ON public.waste_reasons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Per-station allowed waste reasons subset
CREATE TABLE public.station_waste_reasons (
  station_id text NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  reason_id uuid NOT NULL REFERENCES public.waste_reasons(id) ON DELETE CASCADE,
  PRIMARY KEY (station_id, reason_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.station_waste_reasons TO authenticated, anon;
GRANT ALL ON public.station_waste_reasons TO service_role;
ALTER TABLE public.station_waste_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public station_waste_reasons all" ON public.station_waste_reasons USING (true) WITH CHECK (true);

-- 5. Waste (scrap) events
CREATE TABLE public.waste_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_uid text REFERENCES public.product_units(uid) ON DELETE SET NULL,
  station_id text REFERENCES public.stations(id) ON DELETE SET NULL,
  station_name text,
  line_id text,
  production_order_id text,
  lot_number text,
  reason_code text NOT NULL,
  reason_label text NOT NULL,
  reason_category text,
  notes text,
  operator_id text,
  operator_name text,
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_waste_events_station ON public.waste_events(station_id, created_at DESC);
CREATE INDEX ix_waste_events_uid ON public.waste_events(unit_uid);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_events TO authenticated, anon;
GRANT ALL ON public.waste_events TO service_role;
ALTER TABLE public.waste_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public waste_events all" ON public.waste_events USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.waste_events;
ALTER TABLE public.waste_events REPLICA IDENTITY FULL;

-- 6. Station holds (QC / maintenance temporary hold)
CREATE TABLE public.station_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id text NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  hold_type text NOT NULL CHECK (hold_type IN ('qc','maintenance','other')),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_by text,
  opened_by_name text,
  closed_by text,
  closed_by_name text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_station_holds_station ON public.station_holds(station_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.station_holds TO authenticated, anon;
GRANT ALL ON public.station_holds TO service_role;
ALTER TABLE public.station_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public station_holds all" ON public.station_holds USING (true) WITH CHECK (true);
CREATE TRIGGER trg_station_holds_updated_at BEFORE UPDATE ON public.station_holds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.station_holds;
ALTER TABLE public.station_holds REPLICA IDENTITY FULL;

-- 7. Per-unit variable readings captured at a station
CREATE TABLE public.unit_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_uid text NOT NULL REFERENCES public.product_units(uid) ON DELETE CASCADE,
  station_id text REFERENCES public.stations(id) ON DELETE SET NULL,
  unit_event_id text REFERENCES public.unit_events(id) ON DELETE SET NULL,
  mode text CHECK (mode IN ('auto','manual')),
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  operator_id text,
  operator_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_unit_readings_uid ON public.unit_readings(unit_uid, created_at DESC);
CREATE INDEX ix_unit_readings_station ON public.unit_readings(station_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_readings TO authenticated, anon;
GRANT ALL ON public.unit_readings TO service_role;
ALTER TABLE public.unit_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public unit_readings all" ON public.unit_readings USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.unit_readings;
ALTER TABLE public.unit_readings REPLICA IDENTITY FULL;

-- Seed a default waste reason catalog
INSERT INTO public.waste_reasons (code, label, category) VALUES
  ('DIM_OUT_OF_SPEC', 'Dimension out of spec', 'quality'),
  ('SURFACE_DEFECT', 'Surface defect / scratch', 'quality'),
  ('CONTAMINATION', 'Contamination', 'quality'),
  ('MISASSEMBLY', 'Misassembly', 'process'),
  ('BROKEN_COMPONENT', 'Broken component', 'material'),
  ('WRONG_MATERIAL', 'Wrong material lot', 'material'),
  ('MACHINE_FAULT', 'Machine fault / miscalibration', 'equipment'),
  ('OPERATOR_ERROR', 'Operator error', 'process'),
  ('EXPIRED', 'Expired shelf life', 'material'),
  ('OTHER', 'Other (see notes)', 'other')
ON CONFLICT (code) DO NOTHING;
