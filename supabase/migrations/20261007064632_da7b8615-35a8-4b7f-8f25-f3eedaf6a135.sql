CREATE TABLE public.operator_pins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id text NOT NULL,
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.operator_pins TO authenticated;
GRANT ALL ON public.operator_pins TO service_role;
ALTER TABLE public.operator_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own pin row" ON public.operator_pins FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.andon_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id text NOT NULL,
  station_id text,
  kind text NOT NULL DEFAULT 'supervisor',
  message text,
  status text NOT NULL DEFAULT 'open',
  created_by uuid,
  created_by_name text,
  acknowledged_by text,
  acknowledged_at timestamptz,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.andon_calls TO authenticated;
GRANT ALL ON public.andon_calls TO service_role;
ALTER TABLE public.andon_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read andon calls" ON public.andon_calls FOR SELECT TO authenticated USING (private.in_my_org(organization_id));
CREATE POLICY "create andon calls" ON public.andon_calls FOR INSERT TO authenticated WITH CHECK (private.in_my_org(organization_id));
CREATE POLICY "update andon calls" ON public.andon_calls FOR UPDATE TO authenticated USING (private.in_my_org(organization_id)) WITH CHECK (private.in_my_org(organization_id));

CREATE TABLE public.attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id text NOT NULL,
  entity_kind text NOT NULL,
  entity_id text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  content_type text,
  uploaded_by uuid,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read attachments" ON public.attachments FOR SELECT TO authenticated USING (private.in_my_org(organization_id));
CREATE POLICY "add attachments" ON public.attachments FOR INSERT TO authenticated WITH CHECK (private.in_my_org(organization_id));
CREATE POLICY "remove own attachments" ON public.attachments FOR DELETE TO authenticated USING (private.in_my_org(organization_id) AND (uploaded_by = auth.uid() OR private.has_action(auth.uid(), 'masterdata.write'::text)));

CREATE TABLE public.changeover_matrix (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id text NOT NULL,
  from_product_id text,
  to_product_id text,
  minutes integer NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, from_product_id, to_product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.changeover_matrix TO authenticated;
GRANT ALL ON public.changeover_matrix TO service_role;
ALTER TABLE public.changeover_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read changeovers" ON public.changeover_matrix FOR SELECT TO authenticated USING (private.in_my_org(organization_id));
CREATE POLICY "write changeovers" ON public.changeover_matrix FOR ALL TO authenticated USING (private.in_my_org(organization_id) AND private.has_action(auth.uid(), 'masterdata.write'::text)) WITH CHECK (private.in_my_org(organization_id) AND private.has_action(auth.uid(), 'masterdata.write'::text));

CREATE OR REPLACE FUNCTION private.notify_andon_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.notify_users(NEW.organization_id,
    'Andon call: ' || NEW.kind || COALESCE(' at ' || NEW.station_id, ''),
    COALESCE(NEW.message, 'Help requested'), 'andon', NEW.id::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS andon_calls_notify ON public.andon_calls;
CREATE TRIGGER andon_calls_notify AFTER INSERT ON public.andon_calls FOR EACH ROW EXECUTE FUNCTION private.notify_andon_call();