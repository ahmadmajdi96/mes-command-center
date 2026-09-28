ALTER TABLE public.audit_entries DROP CONSTRAINT IF EXISTS audit_entries_action_check;
ALTER TABLE public.audit_entries ADD CONSTRAINT audit_entries_action_check CHECK (length(trim(action)) > 0);