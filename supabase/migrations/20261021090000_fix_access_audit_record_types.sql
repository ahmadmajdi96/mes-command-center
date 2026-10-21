-- The shared trigger runs on three different row types. Referencing NEW.key in a
-- CASE expression still fails to plan for user_role_grants, which has no key.
-- JSON access keeps audit logging active without bypassing permissions/triggers.
CREATE OR REPLACE FUNCTION public.audit_access_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  org text;
  rid text;
  act text;
  before_row jsonb;
  after_row jsonb;
  row_data jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN before_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN after_row := to_jsonb(NEW); END IF;
  row_data := COALESCE(after_row, before_row);
  SELECT organization_id INTO org FROM public.user_orgs(auth.uid()) LIMIT 1;
  IF org IS NULL AND TG_TABLE_NAME = 'user_role_grants' THEN
    SELECT organization_id INTO org FROM public.user_orgs((row_data->>'user_id')::uuid) LIMIT 1;
  END IF;
  -- Service-role bootstrap/global actions have no signed-in actor. Keep a valid
  -- organization reference rather than failing the authorized role operation.
  IF org IS NULL THEN SELECT id INTO org FROM public.organizations ORDER BY created_at, id LIMIT 1; END IF;
  act := lower(TG_OP);
  rid := CASE TG_TABLE_NAME
    WHEN 'roles' THEN row_data->>'key'
    WHEN 'role_permissions' THEN (row_data->>'role_key') || ' → ' || (row_data->>'permission_key')
    ELSE (row_data->>'role_key') || ' for ' || (row_data->>'user_id') END;
  INSERT INTO public.audit_entries
    (id, at, actor_user_id, actor_id, actor_name, entity, entity_id, action, before_data, after_data, summary, organization_id)
  VALUES
    (gen_random_uuid()::text, now(), auth.uid(), COALESCE(auth.uid()::text,'system'), public.actor_name(),
     TG_TABLE_NAME, rid, act, before_row, after_row,
     initcap(act) || ' ' || replace(TG_TABLE_NAME, '_', ' ') || ': ' || rid, org);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.audit_access_change() FROM PUBLIC, anon, authenticated;
