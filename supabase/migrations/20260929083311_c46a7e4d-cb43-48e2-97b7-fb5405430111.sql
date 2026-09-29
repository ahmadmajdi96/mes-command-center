CREATE TABLE public.mock_portal_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.portal_connections(id) ON DELETE CASCADE,
  portal text NOT NULL,
  event_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  signature_ok boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  reply_event text,
  reply_outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz
);
GRANT SELECT ON public.mock_portal_inbox TO authenticated;
GRANT ALL ON public.mock_portal_inbox TO service_role;
ALTER TABLE public.mock_portal_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read mock inbox" ON public.mock_portal_inbox FOR SELECT TO authenticated USING (in_my_org(organization_id));
CREATE INDEX ON public.mock_portal_inbox (connection_id, created_at DESC);