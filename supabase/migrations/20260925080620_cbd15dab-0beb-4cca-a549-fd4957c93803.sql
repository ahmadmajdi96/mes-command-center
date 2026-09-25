CREATE TABLE public.machines (
  id text PRIMARY KEY,
  organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  station_id text REFERENCES public.stations(id) ON DELETE SET NULL,
  name text NOT NULL,
  vendor text,
  model text,
  protocol text NOT NULL,
  endpoint text,
  connection_mode text NOT NULL DEFAULT 'simulated' CHECK (connection_mode IN ('simulated','manual','edge')),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  commands jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'offline',
  last_seen_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT ALL ON public.machines TO service_role;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY machines_read ON public.machines FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY machines_write ON public.machines FOR ALL TO authenticated
  USING (public.in_my_org(organization_id) AND (public.has_action(auth.uid(),'masterdata.write') OR public.is_platform_admin(auth.uid())))
  WITH CHECK (public.in_my_org(organization_id) AND (public.has_action(auth.uid(),'masterdata.write') OR public.is_platform_admin(auth.uid())));
CREATE TRIGGER machines_updated BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.machine_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  machine_id text NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
  station_id text,
  tag text NOT NULL,
  value numeric,
  text_value text,
  unit text,
  in_limits boolean,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','simulated','edge')),
  unit_uid text,
  production_order_id text,
  actor_user_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.machine_readings TO authenticated;
GRANT ALL ON public.machine_readings TO service_role;
ALTER TABLE public.machine_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY mr_read ON public.machine_readings FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY mr_insert ON public.machine_readings FOR INSERT TO authenticated
  WITH CHECK (public.in_my_org(organization_id) AND (public.has_action(auth.uid(),'execution.record') OR public.is_platform_admin(auth.uid())));
CREATE TRIGGER machine_readings_append_only BEFORE UPDATE OR DELETE ON public.machine_readings FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();
CREATE INDEX machine_readings_machine_idx ON public.machine_readings(machine_id, created_at DESC);

CREATE TABLE public.machine_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL DEFAULT 'ORG-01' REFERENCES public.organizations(id),
  machine_id text NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
  command text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','acknowledged','rejected','failed')),
  result text,
  production_order_id text,
  actor_user_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.machine_commands TO authenticated;
GRANT ALL ON public.machine_commands TO service_role;
ALTER TABLE public.machine_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY mc_read ON public.machine_commands FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY mc_insert ON public.machine_commands FOR INSERT TO authenticated
  WITH CHECK (public.in_my_org(organization_id) AND (public.has_action(auth.uid(),'machines.command') OR public.is_platform_admin(auth.uid())));
CREATE POLICY mc_update ON public.machine_commands FOR UPDATE TO authenticated
  USING (public.in_my_org(organization_id) AND (public.has_action(auth.uid(),'machines.command') OR public.is_platform_admin(auth.uid())));

-- Wire readings into execution: out-of-limit value on a hold-on-breach tag puts the machine's station on hold.
CREATE OR REPLACE FUNCTION public.machine_reading_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m record; t jsonb;
BEGIN
  SELECT * INTO m FROM machines WHERE id = NEW.machine_id;
  NEW.station_id := coalesce(NEW.station_id, m.station_id);
  NEW.organization_id := m.organization_id;
  SELECT x INTO t FROM jsonb_array_elements(m.tags) x WHERE x->>'name' = NEW.tag LIMIT 1;
  IF t IS NOT NULL AND NEW.value IS NOT NULL THEN
    NEW.unit := coalesce(NEW.unit, t->>'unit');
    NEW.in_limits := (t->>'min' IS NULL OR NEW.value >= (t->>'min')::numeric) AND (t->>'max' IS NULL OR NEW.value <= (t->>'max')::numeric);
    IF NOT NEW.in_limits AND coalesce((t->>'hold_on_breach')::boolean,false) AND NEW.station_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM station_holds h WHERE h.station_id = NEW.station_id AND h.status = 'open') THEN
      INSERT INTO station_holds (station_id, hold_type, reason, status, opened_by_name, opened_by_user_id, organization_id)
      VALUES (NEW.station_id, 'qc', format('Machine %s: %s = %s %s outside %s–%s', m.name, NEW.tag, NEW.value, coalesce(NEW.unit,''), coalesce(t->>'min','-'), coalesce(t->>'max','-')),
              'open', coalesce(NEW.actor_name,'Machine rule'), NEW.actor_user_id, m.organization_id);
    END IF;
  END IF;
  UPDATE machines SET last_seen_at = now(), status = CASE WHEN status = 'offline' THEN 'online' ELSE status END WHERE id = m.id;
  RETURN NEW;
END $$;
CREATE TRIGGER machine_readings_rules BEFORE INSERT ON public.machine_readings FOR EACH ROW EXECUTE FUNCTION public.machine_reading_rules();
REVOKE EXECUTE ON FUNCTION public.machine_reading_rules() FROM PUBLIC, anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.machine_readings, public.machine_commands, public.machines;