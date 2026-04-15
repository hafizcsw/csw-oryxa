-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cleanup function for expired HMAC nonces
CREATE OR REPLACE FUNCTION public.rpc_cleanup_hmac_nonces(p_minutes int DEFAULT 10)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted int;
BEGIN
  DELETE FROM public.hmac_nonces
  WHERE used_at < now() - (p_minutes || ' minutes')::interval;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Security: Only service_role can call this function
REVOKE EXECUTE ON FUNCTION public.rpc_cleanup_hmac_nonces FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_cleanup_hmac_nonces FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_cleanup_hmac_nonces FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cleanup_hmac_nonces TO service_role;

-- Schedule cleanup every 5 minutes, delete nonces older than 10 minutes
SELECT cron.schedule(
  'cleanup-hmac-nonces',
  '*/5 * * * *',
  $$ SELECT public.rpc_cleanup_hmac_nonces(10); $$
);