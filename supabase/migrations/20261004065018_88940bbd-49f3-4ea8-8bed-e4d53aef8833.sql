ALTER TABLE public.products
  ADD CONSTRAINT products_standard_cost_nonneg CHECK (standard_cost >= 0) NOT VALID,
  ADD CONSTRAINT products_sale_price_nonneg CHECK (sale_price >= 0) NOT VALID,
  ADD CONSTRAINT products_lead_time_nonneg CHECK (lead_time >= 0) NOT VALID,
  ADD CONSTRAINT products_batching_limit_nonneg CHECK (batching_limit >= 0) NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT products_standard_cost_nonneg;
ALTER TABLE public.products VALIDATE CONSTRAINT products_sale_price_nonneg;
ALTER TABLE public.products VALIDATE CONSTRAINT products_lead_time_nonneg;
ALTER TABLE public.products VALIDATE CONSTRAINT products_batching_limit_nonneg;

CREATE OR REPLACE FUNCTION public.guard_recipe_variables()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v jsonb; mn numeric; mx numeric; keys text[] := '{}'; k text;
BEGIN
  IF NEW.target_cycle_sec IS NOT NULL AND NEW.target_cycle_sec < 0 THEN
    RAISE EXCEPTION 'Target cycle cannot be negative';
  END IF;
  IF NEW.variables IS NULL OR jsonb_typeof(NEW.variables) <> 'array' THEN RETURN NEW; END IF;
  FOR v IN SELECT * FROM jsonb_array_elements(NEW.variables) LOOP
    k := btrim(coalesce(v->>'key',''));
    IF k = '' THEN RAISE EXCEPTION 'Every variable needs a key'; END IF;
    IF k = ANY(keys) THEN RAISE EXCEPTION 'Variable key "%" is used twice', k; END IF;
    keys := keys || k;
    mn := NULLIF(v->>'min','')::numeric; mx := NULLIF(v->>'max','')::numeric;
    IF mn IS NOT NULL AND mn < 0 THEN RAISE EXCEPTION 'Min of "%" cannot be negative', k; END IF;
    IF mx IS NOT NULL AND mx < 0 THEN RAISE EXCEPTION 'Max of "%" cannot be negative', k; END IF;
    IF mn IS NOT NULL AND mx IS NOT NULL AND mn > mx THEN RAISE EXCEPTION 'Min of "%" is above its max', k; END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_recipe_variables BEFORE INSERT OR UPDATE ON public.product_station_recipes
FOR EACH ROW EXECUTE FUNCTION public.guard_recipe_variables();