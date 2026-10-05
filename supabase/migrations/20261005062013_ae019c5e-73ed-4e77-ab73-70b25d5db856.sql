CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.actor_name() SET SCHEMA private;
ALTER FUNCTION public.can_admin_users(uuid) SET SCHEMA private;
ALTER FUNCTION public.has_action(uuid, text) SET SCHEMA private;
ALTER FUNCTION public.has_permission(uuid, text, text, text) SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.in_my_org(text) SET SCHEMA private;
ALTER FUNCTION public.is_platform_admin(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_orgs(uuid) SET SCHEMA private;
ALTER FUNCTION public.merge_batches(text, text[], text) SET SCHEMA private;
ALTER FUNCTION public.move_batch(text, text, text) SET SCHEMA private;
ALTER FUNCTION public.split_batch(text, numeric, text) SET SCHEMA private;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

-- Same names stay available in public as thin caller-rights wrappers
CREATE FUNCTION public.actor_name() RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.actor_name() $$;
CREATE FUNCTION public.can_admin_users(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.can_admin_users(_user_id) $$;
CREATE FUNCTION public.has_action(_user_id uuid, _action text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.has_action(_user_id, _action) $$;
CREATE FUNCTION public.has_permission(_user_id uuid, _action text, _scope_kind text, _scope_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.has_permission(_user_id, _action, _scope_kind, _scope_id) $$;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.has_role(_user_id, _role) $$;
CREATE FUNCTION public.in_my_org(_org text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.in_my_org(_org) $$;
CREATE FUNCTION public.is_platform_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.is_platform_admin(_user_id) $$;
CREATE FUNCTION public.user_orgs(_user_id uuid) RETURNS TABLE(organization_id text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT * FROM private.user_orgs(_user_id) $$;
CREATE FUNCTION public.merge_batches(_target text, _sources text[], _reason text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$ SELECT private.merge_batches(_target, _sources, _reason) $$;
CREATE FUNCTION public.move_batch(_batch_id text, _to text, _reason text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$ SELECT private.move_batch(_batch_id, _to, _reason) $$;
CREATE FUNCTION public.split_batch(_batch_id text, _qty numeric, _reason text) RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$ SELECT private.split_batch(_batch_id, _qty, _reason) $$;

REVOKE EXECUTE ON FUNCTION public.actor_name(), public.can_admin_users(uuid), public.has_action(uuid,text), public.has_permission(uuid,text,text,text), public.has_role(uuid,public.app_role), public.in_my_org(text), public.is_platform_admin(uuid), public.user_orgs(uuid), public.merge_batches(text,text[],text), public.move_batch(text,text,text), public.split_batch(text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actor_name(), public.can_admin_users(uuid), public.has_action(uuid,text), public.has_permission(uuid,text,text,text), public.has_role(uuid,public.app_role), public.in_my_org(text), public.is_platform_admin(uuid), public.user_orgs(uuid), public.merge_batches(text,text[],text), public.move_batch(text,text,text), public.split_batch(text,numeric,text) TO authenticated, service_role;