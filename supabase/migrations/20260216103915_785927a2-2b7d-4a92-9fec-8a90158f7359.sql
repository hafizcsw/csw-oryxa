
-- Drop existing function with old signature first
DROP FUNCTION IF EXISTS public.rpc_lock_urls_for_extraction_batchless(integer, text);

-- Recreate with correct return type
CREATE OR REPLACE FUNCTION public.rpc_lock_urls_for_extraction_batchless(
  p_limit INTEGER DEFAULT 5,
  p_locked_by TEXT DEFAULT 'runner'
)
RETURNS TABLE (
  url_id BIGINT,
  url TEXT,
  university_id UUID,
  raw_page_id BIGINT,
  text_content TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH locked AS (
    UPDATE program_urls
    SET locked_at = now(),
        locked_by = p_locked_by,
        lease_expires_at = now() + interval '10 minutes'
    WHERE id IN (
      SELECT pu.id FROM program_urls pu
      WHERE pu.status = 'fetched'
        AND pu.batch_id IS NULL
        AND pu.raw_page_id IS NOT NULL
        AND (pu.lease_expires_at IS NULL OR pu.lease_expires_at < now())
      ORDER BY pu.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
    )
    RETURNING id, url, university_id, raw_page_id
  )
  SELECT l.id AS url_id, l.url, l.university_id, l.raw_page_id,
         rp.text_content
  FROM locked l
  LEFT JOIN raw_pages rp ON rp.id = l.raw_page_id;
$$;

REVOKE ALL ON FUNCTION public.rpc_lock_urls_for_extraction_batchless FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_lock_urls_for_extraction_batchless FROM anon;
REVOKE ALL ON FUNCTION public.rpc_lock_urls_for_extraction_batchless FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_urls_for_extraction_batchless TO service_role;
