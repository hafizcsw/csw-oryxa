
-- ============================================
-- SECURITY FIX: Revoke PUBLIC access to admin RPCs
-- Only service_role should call these
-- ============================================

-- Locking RPCs (admin-only, called via Edge Functions with service_role)
REVOKE EXECUTE ON FUNCTION public.rpc_lock_program_urls_for_fetch(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_lock_universities_for_batch(integer, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_lock_universities_for_discovery(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_lock_universities_for_website_resolution(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_lock_urls_for_extraction(uuid, integer) FROM PUBLIC;

-- Counter RPCs (admin-only)
REVOKE EXECUTE ON FUNCTION public.rpc_increment_batch_counters(uuid, integer, integer, integer, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_increment_batch_programs_discovered(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_increment_batch_programs_extracted(uuid, integer) FROM PUBLIC;

-- Upsert and Publish RPCs (admin-only)
REVOKE EXECUTE ON FUNCTION public.rpc_upsert_program_url(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM PUBLIC;

-- Grant only to service_role (Edge Functions use this)
GRANT EXECUTE ON FUNCTION public.rpc_lock_program_urls_for_fetch(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_batch(integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_discovery(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_website_resolution(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lock_urls_for_extraction(uuid, integer) TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_increment_batch_counters(uuid, integer, integer, integer, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_increment_batch_programs_discovered(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_increment_batch_programs_extracted(uuid, integer) TO service_role;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_program_url(uuid, uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) TO service_role;
