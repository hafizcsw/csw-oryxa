-- Grant EXECUTE on the RPC to service_role (SECURITY DEFINER functions need this)
GRANT EXECUTE ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) TO anon;