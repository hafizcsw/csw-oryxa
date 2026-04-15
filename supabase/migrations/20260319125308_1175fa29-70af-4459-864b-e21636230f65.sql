
-- Drop the stale bigint[] overload that causes PostgREST ambiguity
DROP FUNCTION IF EXISTS public.rpc_publish_programs(bigint[], text);
