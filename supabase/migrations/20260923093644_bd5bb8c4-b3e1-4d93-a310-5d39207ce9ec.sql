-- Internal-only helpers: system roles only
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalc_batch_and_order_progress() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scope_ancestors(text, text) FROM PUBLIC, anon, authenticated;

-- Permission checks: signed-in users only (required by RLS policy evaluation)
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.has_action(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_action(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.has_permission(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.can_admin_users(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_admin_users(uuid) TO authenticated;
