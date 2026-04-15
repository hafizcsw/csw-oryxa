
-- Drop old function first then recreate
DROP FUNCTION IF EXISTS rpc_we_lock_batch(uuid, integer);

-- Add missing traceability columns (safe idempotent)
ALTER TABLE website_enrichment_rows 
  ADD COLUMN IF NOT EXISTS last_stage text,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_owner text;

-- Recreate with correct atomic locking: sets 'processing' not 'pending'
CREATE FUNCTION rpc_we_lock_batch(p_job_id uuid, p_limit int)
RETURNS SETOF website_enrichment_rows
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE website_enrichment_rows
  SET 
    enrichment_status = 'processing',
    attempt_count = attempt_count + 1,
    locked_at = now(),
    updated_at = now(),
    last_stage = 'locked',
    lease_owner = 'worker-' || substr(gen_random_uuid()::text, 1, 8)
  WHERE id IN (
    SELECT id FROM website_enrichment_rows
    WHERE job_id = p_job_id
      AND enrichment_status = 'pending'
      AND attempt_count < 3
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
