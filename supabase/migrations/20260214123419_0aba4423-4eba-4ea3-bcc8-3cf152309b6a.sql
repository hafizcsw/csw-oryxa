-- SECURITY PATCH P1: Revoke EXECUTE from authenticated on all crawl RPCs
-- Only service_role should be able to call these (via Edge Functions)

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
      AND p.proname IN (
        'rpc_lock_universities_for_batch',
        'rpc_lock_universities_for_discovery',
        'rpc_lock_universities_for_website_resolution',
        'rpc_upsert_program_url',
        'rpc_lock_program_urls_for_fetch',
        'rpc_lock_urls_for_extraction',
        'rpc_increment_batch_programs_discovered',
        'rpc_increment_batch_programs_extracted',
        'rpc_seed_program_urls_from_gap',
        'rpc_publish_program_batch',
        'rpc_crawl_batch_summary',
        'rpc_reset_stuck_locks'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon;', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated;', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.sig);
  END LOOP;
END $$;