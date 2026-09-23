-- 1. Membership helpers -------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_orgs(_user_id uuid)
RETURNS TABLE(organization_id text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT a.scope_id
  FROM public.user_role_grants g
  CROSS JOIN LATERAL public.scope_ancestors(g.scope_kind, g.scope_id) a
  WHERE g.user_id = _user_id
    AND g.effective_from <= now()
    AND (g.effective_to IS NULL OR g.effective_to > now())
    AND a.scope_kind = 'org'
    AND a.scope_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.in_my_org(_org text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _org IS NULL
      OR public.is_platform_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_orgs(auth.uid()) o WHERE o.organization_id = _org)
$$;

REVOKE ALL ON FUNCTION public.user_orgs(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_orgs(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.in_my_org(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.in_my_org(text) TO authenticated, service_role;

-- 2. organization_id on every operational table ---------------------------

DO $$
DECLARE t text;
  tables text[] := ARRAY[
    'products','production_orders','production_batches','product_units',
    'unit_events','unit_readings','waste_events','waste_reasons',
    'product_station_recipes','station_holds','downtime_events','quality_holds',
    'genealogy_records','work_orders','mes_users','audit_entries',
    'lines','stations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id text', t);
    EXECUTE format(
      'UPDATE public.%I SET organization_id = ''ORG-01'' WHERE organization_id IS NULL', t);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT ''ORG-01''', t);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', t);
    BEGIN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT',
        t, t || '_organization_id_fkey');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (organization_id)', 'idx_' || t || '_org', t);
    -- Tenant isolation is enforced on top of the existing permission policies.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.in_my_org(organization_id)) WITH CHECK (public.in_my_org(organization_id))',
      t || '_tenant_isolation', t);
  END LOOP;
END $$;

-- 3. Per-tenant integration API keys -------------------------------------

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  label text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage integration keys"
  ON public.api_keys FOR ALL TO authenticated
  USING (public.can_admin_users(auth.uid()) AND public.in_my_org(organization_id))
  WITH CHECK (public.can_admin_users(auth.uid()) AND public.in_my_org(organization_id));

DROP TRIGGER IF EXISTS api_keys_updated_at ON public.api_keys;
CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON public.api_keys (organization_id);