
CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  code text NOT NULL, name text NOT NULL, description text,
  validity_months int,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE TABLE public.operator_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  mes_user_id text NOT NULL REFERENCES public.mes_users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'qualified',
  certified_at date NOT NULL DEFAULT current_date,
  expires_at date,
  certificate_ref text, certified_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mes_user_id, skill_id)
);
CREATE TABLE public.skill_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  operation_name text NOT NULL,
  product_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.inspection_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  name text NOT NULL,
  operation_name text NOT NULL,
  product_id text,
  characteristics jsonb NOT NULL DEFAULT '[]'::jsonb,
  sampling text NOT NULL DEFAULT 'per_operation' CHECK (sampling IN ('per_operation','every_qty')),
  sample_every numeric,
  performed_by text NOT NULL DEFAULT 'local' CHECK (performed_by IN ('local','qa_portal')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.inspection_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.inspection_plans(id),
  operation_id uuid NOT NULL REFERENCES public.order_operations(id),
  production_order_id text NOT NULL,
  batch_id text,
  sample_no int NOT NULL DEFAULT 1,
  "values" jsonb NOT NULL DEFAULT '{}'::jsonb,
  failed_checks text[] NOT NULL DEFAULT '{}',
  result text NOT NULL CHECK (result IN ('pass','fail')),
  source text NOT NULL DEFAULT 'local' CHECK (source IN ('local','qa_portal')),
  notes text, inspector_name text, actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nonconformances (
  id text PRIMARY KEY DEFAULT ('NC-' || to_char(now(),'YYMMDD') || '-' || upper(substr(md5(random()::text),1,5))),
  organization_id text NOT NULL,
  production_order_id text NOT NULL,
  operation_id uuid REFERENCES public.order_operations(id),
  inspection_result_id uuid REFERENCES public.inspection_results(id),
  batch_id text,
  qty numeric NOT NULL DEFAULT 0, uom text,
  severity text NOT NULL DEFAULT 'major' CHECK (severity IN ('minor','major','critical')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','decided','closed')),
  decision text CHECK (decision IN ('use_as_is','rework','scrap','return_to_supplier')),
  decision_notes text, decided_by_name text, decided_at timestamptz, decision_source text,
  rework_task_id uuid,
  raised_by_name text, raised_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 100,
  trigger_kind text NOT NULL CHECK (trigger_kind IN ('inspection_fail','value_out_of_range','product_is')),
  operation_name text,
  product_id text,
  parameter text, min_value numeric, max_value numeric,
  action text NOT NULL CHECK (action IN ('rework_step','hold_step','skip_step')),
  target_operation_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.routing_rule_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  rule_id uuid NOT NULL REFERENCES public.routing_rules(id) ON DELETE CASCADE,
  production_order_id text NOT NULL,
  operation_id uuid,
  action text NOT NULL, detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills, public.operator_skills, public.skill_requirements, public.inspection_plans, public.routing_rules TO authenticated;
GRANT SELECT, INSERT ON public.inspection_results, public.nonconformances TO authenticated;
GRANT SELECT ON public.routing_rule_hits TO authenticated;
GRANT ALL ON public.skills, public.operator_skills, public.skill_requirements, public.inspection_plans, public.inspection_results, public.nonconformances, public.routing_rules, public.routing_rule_hits TO service_role;

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nonconformances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rule_hits ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['skills','operator_skills','skill_requirements','inspection_plans','routing_rules'] LOOP
    EXECUTE format('CREATE POLICY "%1$s read" ON public.%1$I FOR SELECT TO authenticated USING (in_my_org(organization_id))', t);
    EXECUTE format('CREATE POLICY "%1$s write" ON public.%1$I FOR ALL TO authenticated USING (in_my_org(organization_id) AND has_action(auth.uid(), ''masterdata.write'')) WITH CHECK (in_my_org(organization_id) AND has_action(auth.uid(), ''masterdata.write''))', t);
    EXECUTE format('CREATE TRIGGER %1$s_updated BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t) ;
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS skill_requirements_updated ON public.skill_requirements;
CREATE POLICY "inspection_results read" ON public.inspection_results FOR SELECT TO authenticated USING (in_my_org(organization_id));
CREATE POLICY "inspection_results record" ON public.inspection_results FOR INSERT TO authenticated WITH CHECK (in_my_org(organization_id) AND has_action(auth.uid(), 'execution.record') AND source = 'local' AND actor_user_id = auth.uid());
CREATE POLICY "nonconformances read" ON public.nonconformances FOR SELECT TO authenticated USING (in_my_org(organization_id));
CREATE POLICY "nonconformances raise" ON public.nonconformances FOR INSERT TO authenticated WITH CHECK (in_my_org(organization_id) AND (has_action(auth.uid(), 'execution.record') OR has_action(auth.uid(), 'holds.raise')) AND status = 'open' AND decision IS NULL);
CREATE POLICY "routing_rule_hits read" ON public.routing_rule_hits FOR SELECT TO authenticated USING (in_my_org(organization_id));
CREATE TRIGGER nonconformances_updated BEFORE UPDATE ON public.nonconformances FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER inspection_results_immutable BEFORE UPDATE OR DELETE ON public.inspection_results FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

-- Skills the person lacks for this step (empty = qualified)
CREATE OR REPLACE FUNCTION public.operation_missing_skills(_op_id uuid, _user_id uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT s.name ORDER BY s.name), '{}')
  FROM order_operations o
  JOIN production_orders po ON po.id = o.production_order_id
  JOIN skill_requirements r ON r.organization_id = o.organization_id AND lower(r.operation_name) = lower(o.name)
    AND (r.product_id IS NULL OR r.product_id = po.product_id)
  JOIN skills s ON s.id = r.skill_id
  WHERE o.id = _op_id
    AND NOT EXISTS (
      SELECT 1 FROM operator_skills os JOIN mes_users mu ON mu.id = os.mes_user_id
      WHERE os.skill_id = r.skill_id AND mu.auth_user_id = _user_id AND mu.active
        AND os.certified_at <= current_date AND (os.expires_at IS NULL OR os.expires_at >= current_date))
$$;
REVOKE EXECUTE ON FUNCTION public.operation_missing_skills(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.operation_missing_skills(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_operator_skills() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m text[];
BEGIN
  IF NEW.status = 'running' AND OLD.status IN ('pending','ready','rework_required') AND auth.uid() IS NOT NULL THEN
    m := operation_missing_skills(NEW.id, auth.uid());
    IF array_length(m, 1) > 0 THEN
      RAISE EXCEPTION 'You are not qualified for "%": missing or expired certification for %', NEW.name, array_to_string(m, ', ');
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_operator_skills() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER order_operations_skills BEFORE UPDATE ON public.order_operations FOR EACH ROW EXECUTE FUNCTION guard_operator_skills();

-- Apply routing rules for one step after an inspection result
CREATE OR REPLACE FUNCTION public.inspection_after_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; po record; r record; v numeric; hit boolean; nc_id text;
BEGIN
  SELECT * INTO o FROM order_operations WHERE id = NEW.operation_id;
  SELECT * INTO po FROM production_orders WHERE id = NEW.production_order_id;
  IF NEW.result = 'fail' THEN
    INSERT INTO nonconformances (organization_id, production_order_id, operation_id, inspection_result_id, batch_id, qty, uom, severity, description, raised_by_name, raised_by_user_id)
    VALUES (NEW.organization_id, NEW.production_order_id, NEW.operation_id, NEW.id, NEW.batch_id, 0, po.uom, 'major',
      format('Inspection failed at "%s" (sample %s): %s', o.name, NEW.sample_no, coalesce(nullif(array_to_string(NEW.failed_checks, ', '), ''), 'failed')),
      coalesce(NEW.inspector_name, 'Inspection'), NEW.actor_user_id)
    RETURNING id INTO nc_id;
  END IF;
  FOR r IN SELECT * FROM routing_rules WHERE organization_id = NEW.organization_id AND active
      AND trigger_kind IN ('inspection_fail','value_out_of_range')
      AND (operation_name IS NULL OR lower(operation_name) = lower(o.name))
      AND (product_id IS NULL OR product_id = po.product_id) ORDER BY priority LOOP
    hit := false;
    IF r.trigger_kind = 'inspection_fail' THEN hit := NEW.result = 'fail';
    ELSE
      BEGIN v := (NEW."values"->>r.parameter)::numeric; EXCEPTION WHEN others THEN v := NULL; END;
      hit := v IS NOT NULL AND ((r.min_value IS NOT NULL AND v < r.min_value) OR (r.max_value IS NOT NULL AND v > r.max_value));
    END IF;
    CONTINUE WHEN NOT hit;
    IF r.action = 'rework_step' AND o.status IN ('running','partially_completed','completed') THEN
      UPDATE order_operations SET status = 'rework_required', status_reason = 'Routing rule: ' || r.name WHERE id = o.id;
    ELSIF r.action = 'hold_step' AND o.status IN ('running','partially_completed') THEN
      UPDATE order_operations SET status = 'on_hold', hold_category = 'quality', status_reason = 'Routing rule: ' || r.name WHERE id = o.id;
    ELSIF r.action = 'skip_step' THEN
      UPDATE order_operations SET status = 'skipped', status_reason = 'Routing rule: ' || r.name
        WHERE production_order_id = po.id AND lower(name) = lower(r.target_operation_name) AND status IN ('pending','ready');
    END IF;
    INSERT INTO routing_rule_hits (organization_id, rule_id, production_order_id, operation_id, action, detail)
    VALUES (NEW.organization_id, r.id, po.id, o.id, r.action, format('%s at "%s"%s', r.trigger_kind, o.name, CASE WHEN v IS NOT NULL THEN ' value ' || v ELSE '' END));
    EXIT;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.inspection_after_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER inspection_results_rules AFTER INSERT ON public.inspection_results FOR EACH ROW EXECUTE FUNCTION inspection_after_insert();

-- Product rules: skip steps when the order is released
CREATE OR REPLACE FUNCTION public.apply_product_routing_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int;
BEGIN
  IF NEW.status IN ('released','running') AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR r IN SELECT * FROM routing_rules WHERE organization_id = NEW.organization_id AND active AND trigger_kind = 'product_is'
        AND action = 'skip_step' AND product_id = NEW.product_id LOOP
      UPDATE order_operations SET status = 'skipped', status_reason = 'Routing rule: ' || r.name
        WHERE production_order_id = NEW.id AND lower(name) = lower(r.target_operation_name) AND status IN ('pending','ready');
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN
        INSERT INTO routing_rule_hits (organization_id, rule_id, production_order_id, action, detail)
        VALUES (NEW.organization_id, r.id, NEW.id, 'skip_step', format('Skipped "%s" for product %s', r.target_operation_name, NEW.product_id));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_product_routing_rules() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER production_orders_routing_rules AFTER UPDATE ON public.production_orders FOR EACH ROW EXECUTE FUNCTION apply_product_routing_rules();

-- Portal: nonconformances and QA-performed inspections go out
CREATE OR REPLACE FUNCTION public.phase_b_portal_emit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; po record;
BEGIN
  IF TG_TABLE_NAME = 'nonconformances' THEN
    PERFORM enqueue_portal_event(NEW.organization_id, 'qa', 'nonconformance_raised', 'nonconformances', NEW.id, to_jsonb(NEW));
  ELSIF TG_TABLE_NAME = 'order_operations' THEN
    IF NEW.status = 'running' AND OLD.status IS DISTINCT FROM 'running' AND OLD.status <> 'on_hold' THEN
      SELECT * INTO po FROM production_orders WHERE id = NEW.production_order_id;
      FOR p IN SELECT * FROM inspection_plans WHERE organization_id = NEW.organization_id AND active AND performed_by = 'qa_portal'
          AND lower(operation_name) = lower(NEW.name) AND (product_id IS NULL OR product_id = po.product_id) LOOP
        PERFORM enqueue_portal_event(NEW.organization_id, 'qa', 'inspection_requested', 'order_operations', NEW.id::text,
          jsonb_build_object('operation_id', NEW.id, 'plan_id', p.id, 'plan', p.name, 'production_order_id', NEW.production_order_id,
            'operation', NEW.name, 'batch_id', NEW.batch_id, 'characteristics', p.characteristics));
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.phase_b_portal_emit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER nonconformances_portal AFTER INSERT ON public.nonconformances FOR EACH ROW EXECUTE FUNCTION phase_b_portal_emit();
CREATE TRIGGER order_operations_inspection_portal AFTER UPDATE ON public.order_operations FOR EACH ROW EXECUTE FUNCTION phase_b_portal_emit();

ALTER PUBLICATION supabase_realtime ADD TABLE public.inspection_results, public.nonconformances;
