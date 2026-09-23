-- ===== Organization hierarchy =====
CREATE TABLE public.organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sites (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  code text,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.areas (
  id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES public.sites(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lines ADD COLUMN IF NOT EXISTS site_id text REFERENCES public.sites(id);
ALTER TABLE public.lines ADD COLUMN IF NOT EXISTS area_id text REFERENCES public.areas(id);

-- ===== Roles / permissions catalogue =====
CREATE TABLE public.roles (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.role_permissions (
  role_key text NOT NULL REFERENCES public.roles(key) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_role_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key text NOT NULL REFERENCES public.roles(key),
  scope_kind text NOT NULL DEFAULT 'global',
  scope_id text,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  condition text,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_role_grants_scope_kind_check
    CHECK (scope_kind IN ('global','org','site','area','line','station')),
  CONSTRAINT user_role_grants_scope_id_check
    CHECK ((scope_kind = 'global' AND scope_id IS NULL) OR (scope_kind <> 'global' AND scope_id IS NOT NULL))
);
CREATE INDEX user_role_grants_user_idx ON public.user_role_grants(user_id);
GRANT SELECT ON public.user_role_grants TO authenticated;
GRANT ALL ON public.user_role_grants TO service_role;
ALTER TABLE public.user_role_grants ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER user_role_grants_updated_at BEFORE UPDATE ON public.user_role_grants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sites_updated_at BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER areas_updated_at BEFORE UPDATE ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Workforce <-> login identity =====
ALTER TABLE public.mes_users ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.mes_users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.mes_users ADD COLUMN IF NOT EXISTS site_id text REFERENCES public.sites(id);
CREATE UNIQUE INDEX IF NOT EXISTS mes_users_auth_user_id_key ON public.mes_users(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- ===== Scope resolution + permission helpers =====
CREATE OR REPLACE FUNCTION public.scope_ancestors(_kind text, _id text)
RETURNS TABLE (scope_kind text, scope_id text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line text;
  v_area text;
  v_site text;
  v_org text;
BEGIN
  RETURN QUERY SELECT 'global'::text, NULL::text;
  IF _id IS NULL OR _kind IS NULL OR _kind = 'global' THEN RETURN; END IF;

  RETURN QUERY SELECT _kind, _id;

  IF _kind = 'station' THEN
    SELECT s.line_id INTO v_line FROM public.stations s WHERE s.id = _id;
    IF v_line IS NOT NULL THEN RETURN QUERY SELECT 'line'::text, v_line; END IF;
  ELSIF _kind = 'line' THEN
    v_line := _id;
  END IF;

  IF v_line IS NOT NULL THEN
    SELECT l.area_id, l.site_id INTO v_area, v_site FROM public.lines l WHERE l.id = v_line;
    IF v_area IS NOT NULL THEN RETURN QUERY SELECT 'area'::text, v_area; END IF;
  ELSIF _kind = 'area' THEN
    v_area := _id;
  ELSIF _kind = 'site' THEN
    v_site := _id;
  ELSIF _kind = 'org' THEN
    v_org := _id;
  END IF;

  IF v_site IS NULL AND v_area IS NOT NULL THEN
    SELECT a.site_id INTO v_site FROM public.areas a WHERE a.id = v_area;
  END IF;
  IF v_site IS NOT NULL THEN
    RETURN QUERY SELECT 'site'::text, v_site;
    SELECT s.organization_id INTO v_org FROM public.sites s WHERE s.id = v_site;
  END IF;
  IF v_org IS NOT NULL THEN
    RETURN QUERY SELECT 'org'::text, v_org;
  END IF;
END;
$$;

-- Does the user hold this action anywhere (any scope)?
CREATE OR REPLACE FUNCTION public.has_action(_user_id uuid, _action text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_grants g
    JOIN public.role_permissions rp ON rp.role_key = g.role_key
    WHERE g.user_id = _user_id
      AND rp.permission_key = _action
      AND g.effective_from <= now()
      AND (g.effective_to IS NULL OR g.effective_to > now())
  )
$$;

-- Does the user hold this action for the given scope (or an ancestor of it)?
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _action text, _scope_kind text DEFAULT 'global', _scope_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_grants g
    JOIN public.role_permissions rp ON rp.role_key = g.role_key
    JOIN public.scope_ancestors(_scope_kind, _scope_id) a
      ON a.scope_kind = g.scope_kind
     AND (a.scope_id IS NULL AND g.scope_id IS NULL OR a.scope_id = g.scope_id)
    WHERE g.user_id = _user_id
      AND rp.permission_key = _action
      AND g.effective_from <= now()
      AND (g.effective_to IS NULL OR g.effective_to > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_action(_user_id, 'platform.admin')
$$;

CREATE OR REPLACE FUNCTION public.can_admin_users(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_action(_user_id, 'users.admin')
$$;

-- ===== Policies on the authorization tables =====
CREATE POLICY "authenticated read organizations" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write organizations" ON public.organizations FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
GRANT INSERT, UPDATE, DELETE ON public.organizations TO authenticated;

CREATE POLICY "authenticated read sites" ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write sites" ON public.sites FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
GRANT INSERT, UPDATE, DELETE ON public.sites TO authenticated;

CREATE POLICY "authenticated read areas" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write areas" ON public.areas FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
GRANT INSERT, UPDATE, DELETE ON public.areas TO authenticated;

CREATE POLICY "authenticated read roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "read own or admin grants" ON public.user_role_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_admin_users(auth.uid()) OR public.is_platform_admin(auth.uid()));
CREATE POLICY "admins manage grants" ON public.user_role_grants FOR ALL TO authenticated
  USING (public.can_admin_users(auth.uid()) OR public.is_platform_admin(auth.uid()))
  WITH CHECK (public.can_admin_users(auth.uid()) OR public.is_platform_admin(auth.uid()));
GRANT INSERT, UPDATE, DELETE ON public.user_role_grants TO authenticated;

-- ===== Catalogue seed =====
INSERT INTO public.permissions (key, description) VALUES
  ('platform.admin','Full platform administration'),
  ('users.admin','Invite, suspend and grant roles to people'),
  ('masterdata.read','Read products, recipes and master data'),
  ('masterdata.write','Create and edit products and master data'),
  ('recipes.write','Author recipes and step definitions'),
  ('recipes.publish','Approve and publish recipe revisions'),
  ('orders.read','Read production orders and batches'),
  ('orders.write','Create and edit production orders and batches'),
  ('orders.release','Release orders and batches to production'),
  ('plan.write','Schedule and reschedule batches'),
  ('execution.read','Read execution, units and tracking data'),
  ('execution.record','Record station events, readings and waste'),
  ('execution.override','Approve execution exceptions and overrides'),
  ('holds.raise','Raise quality or maintenance holds'),
  ('holds.release','Release quality holds'),
  ('maintenance.clear','Clear maintenance holds'),
  ('downtime.record','Record and resolve downtime events'),
  ('material.handle','Issue, return and verify material lots'),
  ('apps.build','Compose and test operator applications'),
  ('apps.publish','Approve and deploy operator application versions'),
  ('machine.command','Issue machine commands'),
  ('reports.read','Read dashboards, audit and exports'),
  ('demo.seed','Load demo fixtures')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.roles (key, label, description) VALUES
  ('platform_admin','Platform administrator','Platform configuration and identity'),
  ('site_admin','Site administrator','Site users and local configuration'),
  ('production_manager','Production manager','Production oversight and approved overrides'),
  ('planner','Planner','Orders, batch planning and dispatch'),
  ('supervisor','Supervisor / team lead','Dispatch oversight and exception approval'),
  ('operator','Operator','Execute assigned operations'),
  ('process_engineer','Process engineer','Products, routing and recipe authoring'),
  ('quality_inspector','Quality inspector','Inspections, defects and holds'),
  ('quality_approver','Quality approver','Disposition and quality release'),
  ('maintenance','Maintenance technician','Fault investigation and clearance'),
  ('material_handler','Material handler','Material issue, return and verification'),
  ('app_builder','App builder','Compose operator applications'),
  ('app_publisher','App publisher','Approve and target app deployments'),
  ('viewer','Viewer / auditor','Read scoped records and exports')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'platform_admin', key FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('site_admin','users.admin'),('site_admin','masterdata.read'),('site_admin','orders.read'),('site_admin','execution.read'),('site_admin','reports.read'),
  ('production_manager','masterdata.read'),('production_manager','orders.read'),('production_manager','orders.write'),('production_manager','orders.release'),('production_manager','plan.write'),('production_manager','execution.read'),('production_manager','execution.override'),('production_manager','downtime.record'),('production_manager','reports.read'),('production_manager','holds.raise'),
  ('planner','masterdata.read'),('planner','orders.read'),('planner','orders.write'),('planner','orders.release'),('planner','plan.write'),('planner','execution.read'),('planner','reports.read'),
  ('supervisor','masterdata.read'),('supervisor','orders.read'),('supervisor','orders.release'),('supervisor','execution.read'),('supervisor','execution.record'),('supervisor','execution.override'),('supervisor','downtime.record'),('supervisor','holds.raise'),('supervisor','reports.read'),('supervisor','machine.command'),
  ('operator','masterdata.read'),('operator','orders.read'),('operator','execution.read'),('operator','execution.record'),('operator','holds.raise'),('operator','downtime.record'),
  ('process_engineer','masterdata.read'),('process_engineer','masterdata.write'),('process_engineer','recipes.write'),('process_engineer','orders.read'),('process_engineer','execution.read'),('process_engineer','reports.read'),
  ('quality_inspector','masterdata.read'),('quality_inspector','orders.read'),('quality_inspector','execution.read'),('quality_inspector','holds.raise'),('quality_inspector','reports.read'),
  ('quality_approver','masterdata.read'),('quality_approver','orders.read'),('quality_approver','execution.read'),('quality_approver','holds.raise'),('quality_approver','holds.release'),('quality_approver','reports.read'),
  ('maintenance','execution.read'),('maintenance','downtime.record'),('maintenance','maintenance.clear'),('maintenance','holds.raise'),('maintenance','reports.read'),
  ('material_handler','masterdata.read'),('material_handler','orders.read'),('material_handler','execution.read'),('material_handler','material.handle'),
  ('app_builder','masterdata.read'),('app_builder','execution.read'),('app_builder','apps.build'),
  ('app_publisher','masterdata.read'),('app_publisher','execution.read'),('app_publisher','apps.build'),('app_publisher','apps.publish'),
  ('viewer','masterdata.read'),('viewer','orders.read'),('viewer','execution.read'),('viewer','reports.read')
ON CONFLICT DO NOTHING;

INSERT INTO public.organizations (id, name) VALUES ('ORG-01','Cortanex Foods') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sites (id, organization_id, name, code, timezone) VALUES
  ('SITE-P01','ORG-01','Plant 01 — Amman','P01','Asia/Amman'),
  ('SITE-P02','ORG-01','Plant 02 — Zarqa','P02','Asia/Amman')
ON CONFLICT (id) DO NOTHING;
