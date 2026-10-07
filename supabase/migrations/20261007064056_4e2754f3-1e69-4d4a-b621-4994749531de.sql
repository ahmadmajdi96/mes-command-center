ALTER TABLE public.instruction_steps
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS supersedes uuid;

UPDATE public.instruction_steps SET status = 'approved' WHERE status = 'draft';

ALTER TABLE public.instruction_steps
  DROP CONSTRAINT IF EXISTS instruction_steps_status_check;
ALTER TABLE public.instruction_steps
  ADD CONSTRAINT instruction_steps_status_check CHECK (status IN ('draft','approved','retired'));

CREATE OR REPLACE FUNCTION private.guard_instruction_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NULL THEN NEW.status := 'draft'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'approved' THEN
      RAISE EXCEPTION 'Approved instructions cannot be deleted. Create a new version or retire it first.';
    END IF;
    RETURN OLD;
  END IF;
  -- UPDATE
  IF OLD.status = 'approved' AND NEW.status = 'approved' THEN
    IF NEW.title IS DISTINCT FROM OLD.title
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.requires_ack IS DISTINCT FROM OLD.requires_ack
       OR NEW.operation_name IS DISTINCT FROM OLD.operation_name
       OR NEW.product_id IS DISTINCT FROM OLD.product_id
       OR NEW.step_no IS DISTINCT FROM OLD.step_no
       OR NEW.version IS DISTINCT FROM OLD.version THEN
      RAISE EXCEPTION 'Approved instructions are locked. Create a new version to make changes.';
    END IF;
  END IF;
  IF OLD.status = 'retired' AND NEW.status <> 'retired' THEN
    RAISE EXCEPTION 'Retired instructions cannot be reactivated. Create a new version instead.';
  END IF;
  -- Activation: a draft becoming approved retires other approved versions of the same instruction.
  IF OLD.status = 'draft' AND NEW.status = 'approved' THEN
    UPDATE public.instruction_steps
       SET status = 'retired', updated_at = now()
     WHERE organization_id = NEW.organization_id
       AND operation_name = NEW.operation_name
       AND step_no = NEW.step_no
       AND product_id IS NOT DISTINCT FROM NEW.product_id
       AND status = 'approved'
       AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS instruction_steps_guard ON public.instruction_steps;
CREATE TRIGGER instruction_steps_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.instruction_steps
  FOR EACH ROW EXECUTE FUNCTION private.guard_instruction_steps();

DROP POLICY IF EXISTS "read instructions" ON public.instruction_steps;
CREATE POLICY "read instructions" ON public.instruction_steps
  FOR SELECT TO authenticated
  USING (private.in_my_org(organization_id)
         AND (status = 'approved' OR private.has_action(auth.uid(), 'masterdata.write'::text)));