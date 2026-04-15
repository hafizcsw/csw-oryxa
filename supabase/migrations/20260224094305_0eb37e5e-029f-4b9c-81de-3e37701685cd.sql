
-- Fix 2: Atomic row claim RPC (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.rpc_osc_claim_rows(
  p_job_id uuid,
  p_worker_id text,
  p_batch_size int DEFAULT 15
)
RETURNS SETOF official_site_crawl_rows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM official_site_crawl_rows
    WHERE job_id = p_job_id
      AND crawl_status = 'queued'
    ORDER BY created_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE official_site_crawl_rows r
  SET crawl_status = 'fetching',
      locked_at = now(),
      locked_by = p_worker_id,
      updated_at = now()
  FROM claimed c
  WHERE r.id = c.id
  RETURNING r.*;
END;
$$;

-- Fix 3: Atomic tick lease claim RPC
CREATE OR REPLACE FUNCTION public.rpc_osc_claim_tick_lease(
  p_job_id uuid,
  p_owner text,
  p_ttl_seconds int DEFAULT 90
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := 'osc_tick_lease_' || p_job_id::text;
  v_now timestamptz := now();
  v_expires timestamptz;
  v_acquired boolean := false;
BEGIN
  -- Try to acquire or steal expired lease
  INSERT INTO crawl_settings (key, value, updated_at)
  VALUES (
    v_key,
    jsonb_build_object('owner', p_owner, 'acquired_at', v_now, 'expires_at', v_now + (p_ttl_seconds || ' seconds')::interval),
    v_now
  )
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('owner', p_owner, 'acquired_at', v_now, 'expires_at', v_now + (p_ttl_seconds || ' seconds')::interval),
      updated_at = v_now
  WHERE 
    -- Only acquire if expired or no valid lease
    (crawl_settings.value->>'expires_at')::timestamptz < v_now
    OR crawl_settings.value->>'owner' IS NULL;
  
  -- Check if we got it
  SELECT (value->>'owner') = p_owner INTO v_acquired
  FROM crawl_settings WHERE key = v_key;
  
  RETURN COALESCE(v_acquired, false);
END;
$$;

-- Release tick lease
CREATE OR REPLACE FUNCTION public.rpc_osc_release_tick_lease(
  p_job_id uuid,
  p_owner text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM crawl_settings
  WHERE key = 'osc_tick_lease_' || p_job_id::text
    AND (value->>'owner') = p_owner;
END;
$$;

-- Add locked_by column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'official_site_crawl_rows' 
    AND column_name = 'locked_by'
  ) THEN
    ALTER TABLE public.official_site_crawl_rows ADD COLUMN locked_by text;
  END IF;
END $$;
