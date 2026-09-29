-- Approvals + e-signatures
CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('order_release','scrap_over_limit','step_override','version_change')),
  ref_table text NOT NULL, ref_id text NOT NULL,
  summary text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by uuid, requested_by_name text,
  decided_by uuid, decided_by_name text, decided_at timestamptz, decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own org approvals" ON public.approval_requests FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY "request approvals" ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (public.in_my_org(organization_id) AND requested_by = auth.uid() AND status = 'pending' AND decided_by IS NULL);
CREATE TRIGGER approval_requests_updated BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.e_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  signer_id uuid NOT NULL, signer_name text NOT NULL, signer_email text,
  meaning text NOT NULL, ref_table text NOT NULL, ref_id text NOT NULL,
  reason text NOT NULL, signed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.e_signatures TO authenticated;
GRANT ALL ON public.e_signatures TO service_role;
ALTER TABLE public.e_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own org signatures" ON public.e_signatures FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE TRIGGER e_signatures_immutable BEFORE UPDATE OR DELETE ON public.e_signatures FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

CREATE TABLE public.approval_settings (
  organization_id text PRIMARY KEY,
  scrap_limit numeric NOT NULL DEFAULT 50,
  require_release_approval boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.approval_settings TO authenticated;
GRANT ALL ON public.approval_settings TO service_role;
ALTER TABLE public.approval_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read settings" ON public.approval_settings FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY "admins write settings" ON public.approval_settings FOR ALL TO authenticated
  USING (public.in_my_org(organization_id) AND public.has_action(auth.uid(),'masterdata.write'))
  WITH CHECK (public.in_my_org(organization_id) AND public.has_action(auth.uid(),'masterdata.write'));

CREATE OR REPLACE FUNCTION public.has_approval(_kind text, _ref text, _min_qty numeric DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.approval_requests
    WHERE kind = _kind AND ref_id = _ref AND status = 'approved'
      AND (_min_qty IS NULL OR COALESCE((details->>'qty')::numeric, 0) >= _min_qty))
$$;

-- Enforcement: release + version change on orders
CREATE OR REPLACE FUNCTION public.guard_order_approvals() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE req boolean;
BEGIN
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.status = 'released' AND OLD.status IS DISTINCT FROM 'released' AND OLD.status <> 'hold' THEN
    SELECT COALESCE((SELECT require_release_approval FROM approval_settings WHERE organization_id = NEW.organization_id), true) INTO req;
    IF req AND NOT public.has_approval('order_release', NEW.id) THEN
      RAISE EXCEPTION 'Order % needs a signed release approval before it can be released', NEW.number;
    END IF;
  END IF;
  IF OLD.production_version_id IS NOT NULL AND NEW.production_version_id IS DISTINCT FROM OLD.production_version_id
     AND NOT public.has_approval('version_change', NEW.id || ':' || COALESCE(NEW.production_version_id,'')) THEN
    RAISE EXCEPTION 'Changing the production version needs a signed approval';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER production_orders_approvals BEFORE UPDATE ON public.production_orders FOR EACH ROW EXECUTE FUNCTION public.guard_order_approvals();

-- Enforcement: scrap over limit + manual step override (skip)
CREATE OR REPLACE FUNCTION public.guard_operation_approvals() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE lim numeric;
BEGIN
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF COALESCE(NEW.qty_scrap,0) > COALESCE(OLD.qty_scrap,0) THEN
    SELECT scrap_limit INTO lim FROM approval_settings WHERE organization_id = NEW.organization_id;
    lim := COALESCE(lim, 50);
    IF NEW.qty_scrap > lim AND NOT public.has_approval('scrap_over_limit', NEW.id::text, NEW.qty_scrap) THEN
      RAISE EXCEPTION 'Scrap of % is over the limit of % and needs a signed approval', NEW.qty_scrap, lim;
    END IF;
  END IF;
  IF NEW.status = 'skipped' AND OLD.status IS DISTINCT FROM 'skipped'
     AND NOT public.has_approval('step_override', NEW.id::text) THEN
    RAISE EXCEPTION 'Skipping step "%" needs a signed override approval', NEW.name;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_operations_approvals BEFORE UPDATE ON public.order_operations FOR EACH ROW EXECUTE FUNCTION public.guard_operation_approvals();

-- Tools
CREATE TABLE public.tools (
  id text PRIMARY KEY DEFAULT ('TL-' || upper(substr(md5(random()::text),1,6))),
  organization_id text NOT NULL,
  code text NOT NULL, name text NOT NULL, kind text NOT NULL DEFAULT 'tool',
  station_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','worn','out_of_service')),
  calibration_due date, max_uses integer, uses integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tools TO authenticated;
GRANT ALL ON public.tools TO service_role;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read tools" ON public.tools FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY "write tools" ON public.tools FOR ALL TO authenticated
  USING (public.in_my_org(organization_id) AND public.has_action(auth.uid(),'masterdata.write'))
  WITH CHECK (public.in_my_org(organization_id) AND public.has_action(auth.uid(),'masterdata.write'));
CREATE TRIGGER tools_updated BEFORE UPDATE ON public.tools FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tool_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  tool_id text NOT NULL REFERENCES public.tools(id),
  order_operation_id uuid REFERENCES public.order_operations(id),
  used_by uuid DEFAULT auth.uid(), used_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.tool_usages TO authenticated;
GRANT ALL ON public.tool_usages TO service_role;
ALTER TABLE public.tool_usages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read usages" ON public.tool_usages FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY "record usages" ON public.tool_usages FOR INSERT TO authenticated
  WITH CHECK (public.in_my_org(organization_id) AND used_by = auth.uid() AND public.has_action(auth.uid(),'execution.record'));
CREATE TRIGGER tool_usages_immutable BEFORE UPDATE OR DELETE ON public.tool_usages FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

CREATE OR REPLACE FUNCTION public.tool_usage_check() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tools;
BEGIN
  SELECT * INTO t FROM tools WHERE id = NEW.tool_id FOR UPDATE;
  IF t.id IS NULL OR t.organization_id <> NEW.organization_id THEN RAISE EXCEPTION 'Unknown tool'; END IF;
  IF t.status <> 'active' THEN RAISE EXCEPTION 'Tool % is % and cannot be used', t.code, replace(t.status,'_',' '); END IF;
  IF t.calibration_due IS NOT NULL AND t.calibration_due < current_date THEN
    RAISE EXCEPTION 'Tool % calibration expired on %', t.code, t.calibration_due; END IF;
  IF t.max_uses IS NOT NULL AND t.uses >= t.max_uses THEN RAISE EXCEPTION 'Tool % reached its use limit', t.code; END IF;
  UPDATE tools SET uses = uses + 1,
    status = CASE WHEN max_uses IS NOT NULL AND uses + 1 >= max_uses THEN 'worn' ELSE status END
  WHERE id = t.id;
  IF t.max_uses IS NOT NULL AND t.uses + 1 >= t.max_uses THEN
    PERFORM public.enqueue_portal_event(t.organization_id, 'maintenance', 'tool_worn', 'tools', t.id,
      jsonb_build_object('code', t.code, 'name', t.name, 'uses', t.uses + 1, 'max_uses', t.max_uses));
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tool_usage_check() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tool_usages_check BEFORE INSERT ON public.tool_usages FOR EACH ROW EXECUTE FUNCTION public.tool_usage_check();

-- Step-by-step work instructions
CREATE TABLE public.instruction_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  operation_name text NOT NULL, product_id text,
  step_no integer NOT NULL, title text NOT NULL, body text, image_url text,
  requires_ack boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instruction_steps TO authenticated;
GRANT ALL ON public.instruction_steps TO service_role;
ALTER TABLE public.instruction_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read instructions" ON public.instruction_steps FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY "write instructions" ON public.instruction_steps FOR ALL TO authenticated
  USING (public.in_my_org(organization_id) AND public.has_action(auth.uid(),'masterdata.write'))
  WITH CHECK (public.in_my_org(organization_id) AND public.has_action(auth.uid(),'masterdata.write'));
CREATE TRIGGER instruction_steps_updated BEFORE UPDATE ON public.instruction_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.instruction_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  order_operation_id uuid NOT NULL REFERENCES public.order_operations(id),
  step_id uuid NOT NULL REFERENCES public.instruction_steps(id),
  acked_by uuid NOT NULL DEFAULT auth.uid(), acked_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_operation_id, step_id)
);
GRANT SELECT, INSERT ON public.instruction_acks TO authenticated;
GRANT ALL ON public.instruction_acks TO service_role;
ALTER TABLE public.instruction_acks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read acks" ON public.instruction_acks FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY "ack steps" ON public.instruction_acks FOR INSERT TO authenticated
  WITH CHECK (public.in_my_org(organization_id) AND acked_by = auth.uid() AND public.has_action(auth.uid(),'execution.record'));
CREATE TRIGGER instruction_acks_immutable BEFORE UPDATE OR DELETE ON public.instruction_acks FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();

CREATE OR REPLACE FUNCTION public.guard_instruction_acks() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE missing int; prod text;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND auth.uid() IS NOT NULL THEN
    SELECT product_id INTO prod FROM production_orders WHERE id = NEW.production_order_id;
    SELECT count(*) INTO missing FROM instruction_steps s
      WHERE s.requires_ack AND s.organization_id = NEW.organization_id
        AND lower(s.operation_name) = lower(NEW.name) AND (s.product_id IS NULL OR s.product_id = prod)
        AND NOT EXISTS (SELECT 1 FROM instruction_acks a WHERE a.order_operation_id = NEW.id AND a.step_id = s.id);
    IF missing > 0 THEN RAISE EXCEPTION '% work instruction step(s) not yet confirmed for "%"', missing, NEW.name; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_operations_instruction_acks BEFORE UPDATE ON public.order_operations FOR EACH ROW EXECUTE FUNCTION public.guard_instruction_acks();

-- Shared shift plans
CREATE TABLE public.shift_plans (
  organization_id text NOT NULL, key text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  updated_by uuid DEFAULT auth.uid(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, key)
);
GRANT SELECT, INSERT, UPDATE ON public.shift_plans TO authenticated;
GRANT ALL ON public.shift_plans TO service_role;
ALTER TABLE public.shift_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read shift plans" ON public.shift_plans FOR SELECT TO authenticated USING (public.in_my_org(organization_id));
CREATE POLICY "write shift plans" ON public.shift_plans FOR INSERT TO authenticated
  WITH CHECK (public.in_my_org(organization_id) AND (public.has_action(auth.uid(),'users.admin') OR public.has_action(auth.uid(),'masterdata.write')));
CREATE POLICY "update shift plans" ON public.shift_plans FOR UPDATE TO authenticated
  USING (public.in_my_org(organization_id) AND (public.has_action(auth.uid(),'users.admin') OR public.has_action(auth.uid(),'masterdata.write')));
CREATE TRIGGER shift_plans_updated BEFORE UPDATE ON public.shift_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_plans, public.approval_requests;