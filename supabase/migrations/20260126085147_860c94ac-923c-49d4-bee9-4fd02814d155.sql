-- Add missing started_at column to translation_jobs
ALTER TABLE public.translation_jobs ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- RPC for atomic job claiming with FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.rpc_claim_translation_jobs(p_limit int)
RETURNS SETOF translation_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claimed AS (
    SELECT id
    FROM translation_jobs
    WHERE status = 'pending'
    ORDER BY priority DESC, created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE translation_jobs t
  SET status = 'processing',
      attempts = t.attempts + 1,
      started_at = now()
  FROM claimed c
  WHERE t.id = c.id
  RETURNING t.*;
$$;

-- Grant execute to service role only (worker uses service key)
REVOKE ALL ON FUNCTION public.rpc_claim_translation_jobs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_claim_translation_jobs(int) TO service_role;