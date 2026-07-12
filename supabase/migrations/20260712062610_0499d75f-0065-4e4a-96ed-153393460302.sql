-- =========== MES CORE SCHEMA ===========

CREATE TABLE public.lines (
  id text PRIMARY KEY,
  name text NOT NULL,
  plant text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','idle','down','changeover')),
  oee numeric NOT NULL DEFAULT 0,
  availability numeric NOT NULL DEFAULT 0,
  performance numeric NOT NULL DEFAULT 0,
  quality numeric NOT NULL DEFAULT 0,
  current_work_order text,
  product text,
  output integer NOT NULL DEFAULT 0,
  target integer NOT NULL DEFAULT 0,
  uptime text NOT NULL DEFAULT '—',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lines TO anon;
GRANT SELECT ON public.lines TO authenticated;
GRANT ALL ON public.lines TO service_role;
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read lines" ON public.lines FOR SELECT USING (true);

CREATE TABLE public.stations (
  id text PRIMARY KEY,
  line_id text NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
  name text NOT NULL,
  sequence integer NOT NULL,
  type text NOT NULL CHECK (type IN ('manual','automatic')),
  status text NOT NULL CHECK (status IN ('running','idle','down','maintenance')),
  cycle_time_sec integer NOT NULL DEFAULT 0,
  current_step text,
  current_value text,
  target text,
  oee numeric,
  machine jsonb,
  template_ids text[],
  last_tick_at text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_stations_line ON public.stations(line_id);
GRANT SELECT ON public.stations TO anon;
GRANT SELECT ON public.stations TO authenticated;
GRANT ALL ON public.stations TO service_role;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read stations" ON public.stations FOR SELECT USING (true);

CREATE TABLE public.work_orders (
  id text PRIMARY KEY,
  production_order_id text NOT NULL,
  line_id text NOT NULL,
  product text NOT NULL,
  sku text NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled','running','paused','hold','completed')),
  qty_target integer NOT NULL,
  qty_produced integer NOT NULL DEFAULT 0,
  uom text NOT NULL,
  started_at text,
  ends_at text,
  operator text,
  shift text NOT NULL CHECK (shift IN ('A','B','C')),
  progress integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_wo_line ON public.work_orders(line_id);
CREATE INDEX ix_wo_status ON public.work_orders(status);
GRANT SELECT ON public.work_orders TO anon;
GRANT SELECT ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read work_orders" ON public.work_orders FOR SELECT USING (true);

CREATE TABLE public.downtime_events (
  id text PRIMARY KEY,
  line_id text NOT NULL,
  line_name text NOT NULL,
  station_id text,
  assignment_id text,
  operator_id text,
  operator_name text,
  reason_code text NOT NULL,
  category text NOT NULL CHECK (category IN ('equipment_failure','changeover','material_shortage','quality_hold','operator_break')),
  started_at text NOT NULL,
  started_ts timestamptz,
  duration_min integer NOT NULL DEFAULT 0,
  work_order_id text,
  status text NOT NULL CHECK (status IN ('open','resolved')),
  notes text
);
CREATE INDEX ix_dt_line ON public.downtime_events(line_id);
CREATE INDEX ix_dt_category ON public.downtime_events(category);
CREATE INDEX ix_dt_started ON public.downtime_events(started_ts);
GRANT SELECT ON public.downtime_events TO anon;
GRANT SELECT ON public.downtime_events TO authenticated;
GRANT ALL ON public.downtime_events TO service_role;
ALTER TABLE public.downtime_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read downtime" ON public.downtime_events FOR SELECT USING (true);

CREATE TABLE public.quality_holds (
  id text PRIMARY KEY,
  lot_id text NOT NULL,
  work_order_id text NOT NULL,
  line_id text NOT NULL,
  reason text NOT NULL,
  raised_by text NOT NULL,
  raised_at text NOT NULL,
  raised_ts timestamptz,
  status text NOT NULL CHECK (status IN ('open','released','rejected')),
  severity text NOT NULL CHECK (severity IN ('low','medium','high'))
);
CREATE INDEX ix_qh_wo ON public.quality_holds(work_order_id);
GRANT SELECT ON public.quality_holds TO anon;
GRANT SELECT ON public.quality_holds TO authenticated;
GRANT ALL ON public.quality_holds TO service_role;
ALTER TABLE public.quality_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read holds" ON public.quality_holds FOR SELECT USING (true);

CREATE TABLE public.genealogy_records (
  id text PRIMARY KEY,
  work_order_id text NOT NULL,
  output_lot_id text NOT NULL,
  input_lot_id text NOT NULL,
  material text NOT NULL,
  supplier text NOT NULL,
  qty_consumed numeric NOT NULL,
  uom text NOT NULL,
  recorded_at text NOT NULL
);
CREATE INDEX ix_gen_wo ON public.genealogy_records(work_order_id);
CREATE INDEX ix_gen_output ON public.genealogy_records(output_lot_id);
GRANT SELECT ON public.genealogy_records TO anon;
GRANT SELECT ON public.genealogy_records TO authenticated;
GRANT ALL ON public.genealogy_records TO service_role;
ALTER TABLE public.genealogy_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read genealogy" ON public.genealogy_records FOR SELECT USING (true);

CREATE TABLE public.mes_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  mobile text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('operator','supervisor','team_lead')),
  shift text NOT NULL CHECK (shift IN ('A','B','C')),
  status text NOT NULL CHECK (status IN ('active','off-shift','on-break','inactive')),
  skills text
);
GRANT SELECT ON public.mes_users TO anon;
GRANT SELECT ON public.mes_users TO authenticated;
GRANT ALL ON public.mes_users TO service_role;
ALTER TABLE public.mes_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read mes_users" ON public.mes_users FOR SELECT USING (true);

CREATE TABLE public.audit_entries (
  id text PRIMARY KEY,
  at timestamptz NOT NULL,
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('create','update','delete','activate','deactivate')),
  before_data jsonb,
  after_data jsonb,
  summary text NOT NULL
);
CREATE INDEX ix_audit_at ON public.audit_entries(at DESC);
CREATE INDEX ix_audit_entity ON public.audit_entries(entity, entity_id);
CREATE INDEX ix_audit_actor ON public.audit_entries(actor_id);
GRANT SELECT ON public.audit_entries TO anon;
GRANT SELECT ON public.audit_entries TO authenticated;
GRANT ALL ON public.audit_entries TO service_role;
ALTER TABLE public.audit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read audit" ON public.audit_entries FOR SELECT USING (true);
