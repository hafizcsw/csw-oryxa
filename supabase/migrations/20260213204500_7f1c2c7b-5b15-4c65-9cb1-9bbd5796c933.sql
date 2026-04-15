-- Security hardening for crawl RPCs and ingest_errors

-- 1) Restrict ingest_errors exposure
ALTER TABLE public.ingest_errors ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ingest_errors FROM PUBLIC;
REVOKE ALL ON TABLE public.ingest_errors FROM anon;
REVOKE ALL ON TABLE public.ingest_errors FROM authenticated;

-- Optional service role write/read access for operational workers
GRANT SELECT, INSERT ON TABLE public.ingest_errors TO service_role;

-- 2) Harden SECURITY DEFINER functions with fixed search_path
ALTER FUNCTION public.rpc_publish_program_batch(uuid, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.rpc_seed_program_urls_from_gap(uuid, integer)
  SET search_path = public, pg_temp;

-- 3) Restrict execute permissions to service role/admin backend only
REVOKE EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_seed_program_urls_from_gap(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_seed_program_urls_from_gap(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_seed_program_urls_from_gap(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_seed_program_urls_from_gap(uuid, integer) TO service_role;
