-- Ensure program_key upsert compatibility + re-apply RPC hardening after latest CREATE OR REPLACE

-- 1) Replace partial unique index with a normal unique index (NULLs remain non-conflicting in PostgreSQL)
DROP INDEX IF EXISTS public.uq_program_draft_program_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_program_draft_program_key
ON public.program_draft(program_key);

-- 2) Re-apply hardening to SECURITY DEFINER RPCs (search_path + execute grants)
ALTER FUNCTION public.rpc_publish_program_batch(uuid, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.rpc_seed_program_urls_from_gap(uuid, integer)
  SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_seed_program_urls_from_gap(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_seed_program_urls_from_gap(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_seed_program_urls_from_gap(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_seed_program_urls_from_gap(uuid, integer) TO service_role;
