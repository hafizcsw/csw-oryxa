-- Add requeue function for stuck translation jobs
CREATE OR REPLACE FUNCTION public.rpc_requeue_stale_translation_jobs(p_stale_minutes integer DEFAULT 15)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH requeued AS (
    UPDATE translation_jobs
    SET 
      status = CASE 
        WHEN attempts >= 3 THEN 'error'
        ELSE 'pending'
      END,
      last_error = CASE 
        WHEN attempts >= 3 THEN 'Max retries exceeded (stuck in processing)'
        ELSE 'Requeued after stale processing timeout'
      END
    WHERE status = 'processing'
      AND started_at < NOW() - (p_stale_minutes || ' minutes')::interval
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM requeued;
  
  RETURN v_count;
END;
$$;

-- Grant execute to service_role only
REVOKE ALL ON FUNCTION public.rpc_requeue_stale_translation_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_requeue_stale_translation_jobs(integer) TO service_role;