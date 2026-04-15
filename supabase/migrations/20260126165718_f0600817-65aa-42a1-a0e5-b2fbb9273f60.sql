-- Grant execute to postgres role for testing
GRANT EXECUTE ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) TO authenticated;