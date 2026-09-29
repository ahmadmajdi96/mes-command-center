ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS safety_status text NOT NULL DEFAULT 'not_signed',
  ADD COLUMN IF NOT EXISTS safety_valid_until date,
  ADD COLUMN IF NOT EXISTS safety_signed_by text,
  ADD COLUMN IF NOT EXISTS safety_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS config_hash text;

CREATE TABLE public.machine_safety_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES public.organizations(id),
  machine_id text NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved','revoked')),
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  valid_until date,
  config_hash text,
  signed_by uuid NOT NULL,
  signed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.machine_safety_signoffs TO authenticated;
GRANT ALL ON public.machine_safety_signoffs TO service_role;
ALTER TABLE public.machine_safety_signoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own org signoffs" ON public.machine_safety_signoffs FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE TRIGGER machine_signoffs_append_only BEFORE UPDATE OR DELETE ON public.machine_safety_signoffs FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

-- Changing addresses, protocol, mode, tags or commands on a signed-off machine voids the sign-off.
CREATE OR REPLACE FUNCTION public.machine_safety_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.safety_status = 'approved' AND NEW.safety_status = 'approved'
     AND (NEW.protocol IS DISTINCT FROM OLD.protocol OR NEW.endpoint IS DISTINCT FROM OLD.endpoint
       OR NEW.connection_mode IS DISTINCT FROM OLD.connection_mode OR NEW.commands IS DISTINCT FROM OLD.commands
       OR NEW.tags IS DISTINCT FROM OLD.tags) THEN
    NEW.safety_status := 'needs_resign';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.safety_status IS DISTINCT FROM OLD.safety_status
     AND NEW.safety_status = 'approved' AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND coalesce(auth.role(),'') <> 'service_role' THEN
    RAISE EXCEPTION 'Safety sign-off can only be given through the signed sign-off form';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER machines_safety_guard BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.machine_safety_guard();

-- Commands to a real (edge) machine, and any safety-relevant command, need a valid sign-off.
CREATE OR REPLACE FUNCTION public.machine_command_safety_check() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; is_safety boolean;
BEGIN
  SELECT * INTO m FROM machines WHERE id = NEW.machine_id;
  SELECT coalesce(bool_or((c->>'safety')::boolean), false) INTO is_safety
    FROM jsonb_array_elements(coalesce(m.commands,'[]'::jsonb)) c WHERE c->>'name' = NEW.command;
  IF m.connection_mode = 'edge' OR is_safety THEN
    IF m.safety_status <> 'approved' THEN
      RAISE EXCEPTION 'Command blocked: % has no valid safety sign-off (status: %)', m.name, m.safety_status;
    END IF;
    IF m.safety_valid_until IS NOT NULL AND m.safety_valid_until < current_date THEN
      RAISE EXCEPTION 'Command blocked: safety sign-off for % expired on %', m.name, m.safety_valid_until;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER machine_commands_safety BEFORE INSERT ON public.machine_commands FOR EACH ROW EXECUTE FUNCTION public.machine_command_safety_check();