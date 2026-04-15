
-- Drop old rpc_set_crawl_paused with different return type, then recreate
DROP FUNCTION IF EXISTS public.rpc_set_crawl_paused(BOOLEAN);

CREATE OR REPLACE FUNCTION public.rpc_set_crawl_paused(p_paused BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO crawl_settings (key, value, updated_at)
  VALUES ('is_paused', jsonb_build_object('paused', p_paused), now())
  ON CONFLICT (key) DO UPDATE SET value = jsonb_build_object('paused', p_paused), updated_at = now();
  
  RETURN jsonb_build_object('paused', p_paused);
END; $$;

REVOKE EXECUTE ON FUNCTION public.rpc_set_crawl_paused(BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_set_crawl_paused(BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_set_crawl_paused(BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_crawl_paused(BOOLEAN) TO service_role;
