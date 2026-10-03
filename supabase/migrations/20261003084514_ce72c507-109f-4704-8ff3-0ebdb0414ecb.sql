
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS color text, ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.roles SET is_system = true;
ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS category text;
UPDATE public.permissions SET category = CASE split_part(key,'.',1)
  WHEN 'platform' THEN 'Administration' WHEN 'users' THEN 'Administration' WHEN 'demo' THEN 'Administration'
  WHEN 'masterdata' THEN 'Master data' WHEN 'recipes' THEN 'Master data'
  WHEN 'orders' THEN 'Orders & planning' WHEN 'plan' THEN 'Orders & planning'
  WHEN 'execution' THEN 'Execution' WHEN 'downtime' THEN 'Execution' WHEN 'material' THEN 'Execution'
  WHEN 'holds' THEN 'Quality & holds' WHEN 'maintenance' THEN 'Quality & holds'
  WHEN 'machine' THEN 'Machines' WHEN 'machines' THEN 'Machines'
  WHEN 'apps' THEN 'Edge apps' WHEN 'reports' THEN 'Reports' ELSE 'Other' END;

GRANT INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT INSERT, DELETE ON public.role_permissions TO authenticated;

CREATE POLICY "admins create roles" ON public.roles FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_users(auth.uid()) AND is_system = false);
CREATE POLICY "admins update roles" ON public.roles FOR UPDATE TO authenticated
  USING (public.can_admin_users(auth.uid())) WITH CHECK (public.can_admin_users(auth.uid()));
CREATE POLICY "admins delete custom roles" ON public.roles FOR DELETE TO authenticated
  USING (public.can_admin_users(auth.uid()) AND is_system = false);
CREATE POLICY "admins add role permissions" ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_users(auth.uid()) AND (permission_key <> 'platform.admin' OR public.is_platform_admin(auth.uid())));
CREATE POLICY "admins remove role permissions" ON public.role_permissions FOR DELETE TO authenticated
  USING (public.can_admin_users(auth.uid()) AND (permission_key <> 'platform.admin' OR public.is_platform_admin(auth.uid())));

CREATE OR REPLACE FUNCTION public.guard_roles() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.key <> OLD.key THEN RAISE EXCEPTION 'A role key cannot be changed'; END IF;
    IF NEW.is_system <> OLD.is_system AND auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Built-in flag cannot be changed'; END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.user_role_grants WHERE role_key = OLD.key AND (effective_to IS NULL OR effective_to > now())) THEN
      RAISE EXCEPTION 'This role is still assigned to people — withdraw it first';
    END IF;
    DELETE FROM public.role_permissions WHERE role_key = OLD.key;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_roles BEFORE UPDATE OR DELETE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.guard_roles();

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id text,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  link text,
  severity text NOT NULL DEFAULT 'info',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE TABLE public.notification_prefs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs" ON public.notification_prefs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Recipients: active people in the org (or global) whose roles hold the action
CREATE OR REPLACE FUNCTION public.notify_users(_org text, _action text, _type text, _title text, _msg text, _link text, _sev text, _exclude uuid DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, organization_id, type, title, message, link, severity)
  SELECT DISTINCT g.user_id, _org, _type, _title, _msg, _link, _sev
  FROM public.user_role_grants g
  JOIN public.role_permissions rp ON rp.role_key = g.role_key
  WHERE (rp.permission_key = _action OR rp.permission_key = 'platform.admin')
    AND g.effective_from <= now() AND (g.effective_to IS NULL OR g.effective_to > now())
    AND (g.user_id IS DISTINCT FROM _exclude)
    AND (_org IS NULL OR g.scope_kind = 'global' OR EXISTS (
      SELECT 1 FROM public.scope_ancestors(g.scope_kind, g.scope_id) a WHERE a.scope_kind='org' AND a.scope_id=_org))
    AND NOT EXISTS (SELECT 1 FROM public.notification_prefs p WHERE p.user_id = g.user_id AND p.type = _type AND p.enabled = false)
$$;
CREATE OR REPLACE FUNCTION public.notify_user(_uid uuid, _org text, _type text, _title text, _msg text, _link text, _sev text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, organization_id, type, title, message, link, severity)
  SELECT _uid, _org, _type, _title, _msg, _link, _sev
  WHERE _uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.notification_prefs p WHERE p.user_id=_uid AND p.type=_type AND p.enabled=false)
$$;
REVOKE EXECUTE ON FUNCTION public.notify_users(text,text,text,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.emit_notifications() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'approval_requests' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.notify_users(NEW.organization_id, 'orders.release', 'approval_requested',
        'Approval needed: ' || replace(NEW.kind,'_',' '), coalesce(NEW.summary, NEW.ref_id) || ' — requested by ' || coalesce(NEW.requested_by_name,'someone'),
        '/approvals', 'warning', NEW.requested_by);
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected') THEN
      PERFORM public.notify_user(NEW.requested_by, NEW.organization_id, 'approval_decided',
        'Your request was ' || NEW.status, coalesce(NEW.summary, NEW.ref_id) || coalesce(' — ' || NEW.decision_reason,''),
        '/approvals', CASE WHEN NEW.status='approved' THEN 'success' ELSE 'error' END);
    END IF;
  ELSIF TG_TABLE_NAME = 'downtime_events' THEN
    PERFORM public.notify_users(NEW.organization_id, 'downtime.record', 'downtime',
      'Downtime on ' || coalesce(NEW.line_name, NEW.line_id), NEW.reason_code || ' (' || replace(NEW.category,'_',' ') || ')',
      '/record/downtime/' || NEW.id, 'error', NULL);
  ELSIF TG_TABLE_NAME = 'order_holds' THEN
    PERFORM public.notify_users(NEW.organization_id, 'holds.release', 'hold',
      'Order ' || NEW.production_order_id || ' put on hold', NEW.reason, '/production-orders/' || NEW.production_order_id, 'warning', NEW.opened_by_user_id);
  ELSIF TG_TABLE_NAME = 'station_holds' THEN
    PERFORM public.notify_users(NEW.organization_id, 'holds.release', 'hold',
      'Station ' || NEW.station_id || ' on ' || NEW.hold_type || ' hold', NEW.reason, '/stations/' || NEW.station_id, 'warning', NEW.opened_by_user_id);
  ELSIF TG_TABLE_NAME = 'quality_holds' THEN
    PERFORM public.notify_users(NEW.organization_id, 'holds.release', 'hold',
      'Quality hold on lot ' || NEW.lot_id, NEW.reason, '/quality', 'warning', NULL);
  ELSIF TG_TABLE_NAME = 'nonconformances' THEN
    PERFORM public.notify_users(NEW.organization_id, 'holds.release', 'nonconformance',
      'Nonconformance ' || NEW.id, coalesce(NEW.description,'') || ' · order ' || coalesce(NEW.production_order_id,'—'), '/nonconformance/' || NEW.id,
      CASE WHEN NEW.severity IN ('major','critical') THEN 'error' ELSE 'warning' END, NEW.raised_by_user_id);
  ELSIF TG_TABLE_NAME = 'machine_commands' THEN
    IF NEW.status IN ('failed','rejected','blocked') AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
      PERFORM public.notify_user(NEW.actor_user_id, NEW.organization_id, 'machine', 'Machine command ' || NEW.status,
        NEW.command || ' on ' || NEW.machine_id, '/machines/' || NEW.machine_id, 'error');
    END IF;
  ELSIF TG_TABLE_NAME = 'user_role_grants' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.notify_user(NEW.user_id, NULL, 'access', 'New role: ' || NEW.role_key,
        'Scope: ' || NEW.scope_kind || coalesce(' ' || NEW.scope_id, ''), '/profile', 'info');
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.notify_user(OLD.user_id, NULL, 'access', 'Role withdrawn: ' || OLD.role_key,
        'Scope: ' || OLD.scope_kind || coalesce(' ' || OLD.scope_id, ''), '/profile', 'warning');
      RETURN OLD;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN others THEN
  RETURN COALESCE(NEW, OLD); -- notifications must never block production work
END $$;
REVOKE EXECUTE ON FUNCTION public.emit_notifications() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_approval AFTER INSERT OR UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.emit_notifications();
CREATE TRIGGER trg_notify_downtime AFTER INSERT ON public.downtime_events FOR EACH ROW EXECUTE FUNCTION public.emit_notifications();
CREATE TRIGGER trg_notify_order_hold AFTER INSERT ON public.order_holds FOR EACH ROW EXECUTE FUNCTION public.emit_notifications();
CREATE TRIGGER trg_notify_station_hold AFTER INSERT ON public.station_holds FOR EACH ROW EXECUTE FUNCTION public.emit_notifications();
CREATE TRIGGER trg_notify_quality_hold AFTER INSERT ON public.quality_holds FOR EACH ROW EXECUTE FUNCTION public.emit_notifications();
CREATE TRIGGER trg_notify_nc AFTER INSERT ON public.nonconformances FOR EACH ROW EXECUTE FUNCTION public.emit_notifications();
CREATE TRIGGER trg_notify_machine AFTER INSERT OR UPDATE ON public.machine_commands FOR EACH ROW EXECUTE FUNCTION public.emit_notifications();
CREATE TRIGGER trg_notify_grants AFTER INSERT OR DELETE ON public.user_role_grants FOR EACH ROW EXECUTE FUNCTION public.emit_notifications();
