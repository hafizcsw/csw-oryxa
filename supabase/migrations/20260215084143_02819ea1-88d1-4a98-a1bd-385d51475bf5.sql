-- Fix #1: RPC for crawl pause/unpause (Non-Negotiable: no direct UPDATE)
CREATE OR REPLACE FUNCTION public.rpc_set_crawl_paused(p_paused boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO crawl_settings (key, value, updated_at)
  VALUES ('is_paused', jsonb_build_object('paused', p_paused), now())
  ON CONFLICT (key) DO UPDATE
  SET value = jsonb_build_object('paused', p_paused),
      updated_at = now();
END;
$$;

-- Restrict to service_role only
REVOKE ALL ON FUNCTION public.rpc_set_crawl_paused(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_set_crawl_paused(boolean) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_set_crawl_paused(boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_crawl_paused(boolean) TO service_role;