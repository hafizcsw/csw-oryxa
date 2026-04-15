-- ============================================
-- SECURITY FIX: Complete RPC Access Control
-- Revoke from PUBLIC, anon, authenticated
-- Grant ONLY to service_role
-- ============================================

-- rpc_lock_program_urls_for_fetch
REVOKE ALL ON FUNCTION public.rpc_lock_program_urls_for_fetch(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_lock_program_urls_for_fetch(uuid, integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_lock_program_urls_for_fetch(uuid, integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_program_urls_for_fetch(uuid, integer, text) TO service_role;

-- rpc_lock_universities_for_batch
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_batch(integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_batch(integer, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_batch(integer, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_batch(integer, boolean) TO service_role;

-- rpc_lock_universities_for_discovery
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_discovery(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_discovery(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_discovery(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_discovery(uuid, integer) TO service_role;

-- rpc_lock_universities_for_website_resolution
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_website_resolution(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_website_resolution(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_website_resolution(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_website_resolution(uuid, integer) TO service_role;

-- rpc_lock_urls_for_extraction
REVOKE ALL ON FUNCTION public.rpc_lock_urls_for_extraction(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_lock_urls_for_extraction(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_lock_urls_for_extraction(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_urls_for_extraction(uuid, integer) TO service_role;

-- rpc_increment_batch_counters
REVOKE ALL ON FUNCTION public.rpc_increment_batch_counters(uuid, integer, integer, integer, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_increment_batch_counters(uuid, integer, integer, integer, integer, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_increment_batch_counters(uuid, integer, integer, integer, integer, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_increment_batch_counters(uuid, integer, integer, integer, integer, integer, integer) TO service_role;

-- rpc_increment_batch_programs_discovered
REVOKE ALL ON FUNCTION public.rpc_increment_batch_programs_discovered(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_increment_batch_programs_discovered(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_increment_batch_programs_discovered(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_increment_batch_programs_discovered(uuid, integer) TO service_role;

-- rpc_increment_batch_programs_extracted
REVOKE ALL ON FUNCTION public.rpc_increment_batch_programs_extracted(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_increment_batch_programs_extracted(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_increment_batch_programs_extracted(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_increment_batch_programs_extracted(uuid, integer) TO service_role;

-- rpc_upsert_program_url
REVOKE ALL ON FUNCTION public.rpc_upsert_program_url(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_upsert_program_url(uuid, uuid, text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_upsert_program_url(uuid, uuid, text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_program_url(uuid, uuid, text, text, text, text, text) TO service_role;

-- rpc_publish_program_batch
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) TO service_role;

-- ============================================
-- FIX: Conditional batch_id update in upsert
-- Only update batch_id when status is pending/retry
-- ============================================

CREATE OR REPLACE FUNCTION public.rpc_upsert_program_url(
  p_university_id uuid,
  p_batch_id uuid,
  p_url text,
  p_canonical_url text,
  p_url_hash text,
  p_kind text,
  p_discovered_from text
)
RETURNS TABLE(id bigint, is_new boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH up AS (
  INSERT INTO program_urls (
    university_id, batch_id, url, canonical_url, url_hash, kind, discovered_from, status
  ) VALUES (
    p_university_id, p_batch_id, p_url, p_canonical_url, p_url_hash, p_kind, p_discovered_from, 'pending'
  )
  ON CONFLICT (university_id, canonical_url) DO UPDATE
  SET
    -- ONLY update batch_id when status allows (pending/retry)
    batch_id = CASE
      WHEN program_urls.status IN ('pending', 'retry') THEN EXCLUDED.batch_id
      ELSE program_urls.batch_id
    END,
    url = EXCLUDED.url,
    kind = CASE WHEN EXCLUDED.kind = 'unknown' THEN program_urls.kind ELSE EXCLUDED.kind END,
    discovered_from = EXCLUDED.discovered_from,
    url_hash = EXCLUDED.url_hash
    -- CRITICAL: Never touch status, raw_page_id, locked_at, locked_by, retry_at, fetch_error
  RETURNING program_urls.id, (xmax = 0) AS is_new
)
SELECT id, is_new FROM up;
$$;