-- Grant execute to postgres (superuser for testing)
GRANT EXECUTE ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) TO postgres;