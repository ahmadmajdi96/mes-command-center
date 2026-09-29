CREATE OR REPLACE FUNCTION public.has_action(_user_id uuid, _action text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_role_grants g JOIN public.role_permissions rp ON rp.role_key = g.role_key
    WHERE g.user_id = _user_id AND rp.permission_key = _action
      AND g.effective_from <= now() AND (g.effective_to IS NULL OR g.effective_to > now()))
$$;
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _action text, _scope_kind text DEFAULT 'global', _scope_id text DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_role_grants g JOIN public.role_permissions rp ON rp.role_key = g.role_key
    JOIN public.scope_ancestors(_scope_kind, _scope_id) a ON a.scope_kind = g.scope_kind
     AND (a.scope_id IS NULL AND g.scope_id IS NULL OR a.scope_id = g.scope_id)
    WHERE g.user_id = _user_id AND rp.permission_key = _action
      AND g.effective_from <= now() AND (g.effective_to IS NULL OR g.effective_to > now()))
$$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.user_orgs(_user_id uuid) RETURNS TABLE(organization_id text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT a.scope_id FROM public.user_role_grants g
  CROSS JOIN LATERAL public.scope_ancestors(g.scope_kind, g.scope_id) a
  WHERE (auth.uid() IS NULL OR _user_id = auth.uid()) AND g.user_id = _user_id
    AND g.effective_from <= now() AND (g.effective_to IS NULL OR g.effective_to > now())
    AND a.scope_kind = 'org' AND a.scope_id IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.actor_name() FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_batches(text, text[], text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.move_batch(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.split_batch(text, numeric, text) FROM anon;