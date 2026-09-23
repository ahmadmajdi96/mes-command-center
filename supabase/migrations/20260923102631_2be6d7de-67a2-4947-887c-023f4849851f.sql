REVOKE ALL ON FUNCTION public.user_orgs(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.in_my_org(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_orgs(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.in_my_org(text) TO authenticated, service_role;