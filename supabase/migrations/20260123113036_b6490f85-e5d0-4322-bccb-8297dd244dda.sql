-- Table for HMAC nonce de-duplication (prevents replay attacks)
CREATE TABLE IF NOT EXISTS public.hmac_nonces (
  nonce TEXT PRIMARY KEY,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Auto-cleanup old nonces (older than 10 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_old_nonces()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.hmac_nonces WHERE used_at < now() - INTERVAL '10 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to cleanup on insert
DROP TRIGGER IF EXISTS trigger_cleanup_old_nonces ON public.hmac_nonces;
CREATE TRIGGER trigger_cleanup_old_nonces
  AFTER INSERT ON public.hmac_nonces
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_nonces();

-- Allow service role to manage nonces
ALTER TABLE public.hmac_nonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage nonces"
  ON public.hmac_nonces
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Table for CRM → Portal bridge events (integration_events)
CREATE TABLE IF NOT EXISTS public.integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for processing queue
CREATE INDEX IF NOT EXISTS idx_integration_events_status ON public.integration_events(status, created_at);

-- RLS for integration_events
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage integration events"
  ON public.integration_events
  FOR ALL
  USING (true)
  WITH CHECK (true);