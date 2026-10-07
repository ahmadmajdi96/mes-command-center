CREATE TABLE public.downtime_reason_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  category text NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  planned boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.downtime_reason_codes TO authenticated;
GRANT ALL ON public.downtime_reason_codes TO service_role;
ALTER TABLE public.downtime_reason_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read reason codes" ON public.downtime_reason_codes FOR SELECT TO authenticated USING (private.in_my_org(organization_id));
CREATE POLICY "manage reason codes" ON public.downtime_reason_codes FOR ALL TO authenticated
  USING (private.in_my_org(organization_id) AND private.has_action(auth.uid(), 'masterdata.write'))
  WITH CHECK (private.in_my_org(organization_id) AND private.has_action(auth.uid(), 'masterdata.write'));
CREATE TRIGGER trg_reason_codes_updated BEFORE UPDATE ON public.downtime_reason_codes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.downtime_reason_codes (organization_id, category, code, label, planned)
SELECT o.id, v.category, v.code, v.label, v.planned FROM public.organizations o,
(VALUES ('Mechanical','MECH-JAM','Jam / blockage',false),('Mechanical','MECH-BRK','Breakdown',false),
 ('Electrical','ELEC-PWR','Power loss',false),('Electrical','ELEC-SNS','Sensor fault',false),
 ('Material','MAT-SHORT','Material shortage',false),('Material','MAT-QUAL','Material quality issue',false),
 ('Quality','QA-HOLD','Quality hold',false),('Changeover','CHG-PROD','Product changeover',true),
 ('Changeover','CHG-CLEAN','Cleaning',true),('People','PPL-NOOP','No operator',false),
 ('Planned','PLN-PM','Planned maintenance',true),('Planned','PLN-BREAK','Scheduled break',true)) v(category, code, label, planned);

CREATE TABLE public.auth_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  success boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.auth_login_attempts TO service_role;
ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.auth_login_attempts (lower(email), created_at DESC);

ALTER TABLE public.approval_settings
  ADD COLUMN IF NOT EXISTS downtime_reason_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS escalate_after_hours integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS idle_signout_minutes integer NOT NULL DEFAULT 15;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.approval_requests ADD COLUMN IF NOT EXISTS escalated_at timestamptz;
ALTER TABLE public.downtime_events ADD COLUMN IF NOT EXISTS reason_alerted_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_lot_expiry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE l record;
BEGIN
  IF NEW.lot_id IS NULL THEN RETURN NEW; END IF;
  SELECT lot_number, expiry_date, status INTO l FROM material_lots WHERE id = NEW.lot_id;
  IF l.expiry_date IS NOT NULL AND l.expiry_date < current_date THEN
    RAISE EXCEPTION 'Lot % expired on % and cannot be used', l.lot_number, l.expiry_date;
  END IF;
  IF l.status IN ('blocked','quarantine','expired','recalled') THEN
    RAISE EXCEPTION 'Lot % is % and cannot be used', l.lot_number, l.status;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_lot_expiry BEFORE INSERT ON public.material_consumptions FOR EACH ROW EXECUTE FUNCTION public.guard_lot_expiry();

CREATE OR REPLACE FUNCTION public.audit_access_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org text; rid text; act text;
BEGIN
  SELECT organization_id INTO org FROM public.user_orgs(auth.uid()) LIMIT 1;
  act := lower(TG_OP);
  rid := CASE TG_TABLE_NAME
    WHEN 'roles' THEN COALESCE(NEW.key, OLD.key)
    WHEN 'role_permissions' THEN COALESCE(NEW.role_key, OLD.role_key) || ' → ' || COALESCE(NEW.permission_key, OLD.permission_key)
    ELSE COALESCE(NEW.role_key, OLD.role_key) || ' for ' || COALESCE(NEW.user_id, OLD.user_id)::text END;
  INSERT INTO public.audit_entries (id, at, actor_user_id, actor_id, actor_name, entity, entity_id, action, before_data, after_data, summary, organization_id)
  VALUES (gen_random_uuid()::text, now(), auth.uid(), COALESCE(auth.uid()::text,'system'), public.actor_name(), TG_TABLE_NAME, rid, act,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END, CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
    initcap(act) || ' ' || replace(TG_TABLE_NAME, '_', ' ') || ': ' || rid, org);
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.audit_access_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_audit_roles AFTER INSERT OR UPDATE OR DELETE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.audit_access_change();
CREATE TRIGGER trg_audit_role_perms AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_access_change();
CREATE TRIGGER trg_audit_role_grants AFTER INSERT OR UPDATE OR DELETE ON public.user_role_grants FOR EACH ROW EXECUTE FUNCTION public.audit_access_change();

CREATE OR REPLACE FUNCTION public.run_reminders() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT a.* FROM approval_requests a JOIN approval_settings s ON s.organization_id = a.organization_id
    WHERE a.status = 'pending' AND a.escalated_at IS NULL AND a.created_at < now() - make_interval(hours => s.escalate_after_hours)
  LOOP
    PERFORM notify_users(r.organization_id, 'execution.override', 'approval', 'Approval waiting too long',
      r.summary || ' has waited more than the allowed time', '/approvals', 'warning', NULL);
    UPDATE approval_requests SET escalated_at = now() WHERE id = r.id;
  END LOOP;
  FOR r IN SELECT d.* FROM downtime_events d JOIN approval_settings s ON s.organization_id = d.organization_id
    WHERE COALESCE(d.reason_code,'') IN ('', 'UNKNOWN') AND d.reason_alerted_at IS NULL AND d.started_ts IS NOT NULL
      AND d.started_ts < now() - make_interval(mins => s.downtime_reason_minutes)
  LOOP
    PERFORM notify_users(r.organization_id, 'downtime.record', 'downtime', 'Downtime reason missing',
      'Stop ' || r.id || ' on ' || COALESCE(r.line_name, r.line_id, '') || ' still has no reason', '/downtime', 'warning', NULL);
    UPDATE downtime_events SET reason_alerted_at = now() WHERE id = r.id;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.run_reminders() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('mes-reminders', '0 * * * *', 'select public.run_reminders()');