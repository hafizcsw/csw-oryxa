-- Add tick lease columns to website_enrichment_jobs
ALTER TABLE public.website_enrichment_jobs
  ADD COLUMN IF NOT EXISTS tick_lease_owner text,
  ADD COLUMN IF NOT EXISTS tick_lease_expires_at timestamptz;

-- Drop the ineffective advisory lock wrapper
DROP FUNCTION IF EXISTS public.pg_try_advisory_xact_lock(int);

-- Atomic lease claim RPC: returns true if lease acquired, false otherwise
CREATE OR REPLACE FUNCTION public.rpc_we_claim_tick_lease(
  p_job_id uuid,
  p_owner text,
  p_ttl_seconds int DEFAULT 90
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected int;
BEGIN
  UPDATE website_enrichment_jobs
  SET tick_lease_owner = p_owner,
      tick_lease_expires_at = now() + (p_ttl_seconds || ' seconds')::interval,
      last_activity_at = now()
  WHERE id = p_job_id
    AND status = 'running'
    AND (tick_lease_owner IS NULL OR tick_lease_expires_at < now())
  ;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

-- Release lease RPC (best-effort, only releases if caller is the owner)
CREATE OR REPLACE FUNCTION public.rpc_we_release_tick_lease(
  p_job_id uuid,
  p_owner text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE website_enrichment_jobs
  SET tick_lease_owner = NULL,
      tick_lease_expires_at = NULL
  WHERE id = p_job_id
    AND tick_lease_owner = p_owner;
END;
$$;