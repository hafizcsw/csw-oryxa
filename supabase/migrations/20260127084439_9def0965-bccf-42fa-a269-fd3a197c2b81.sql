-- Grant execute on RPC to service_role for Edge Function usage
GRANT EXECUTE ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) TO service_role;