DROP FUNCTION IF EXISTS public.rpc_lock_urls_for_extraction(uuid, integer, text);

CREATE OR REPLACE FUNCTION public.rpc_lock_urls_for_extraction(
  p_batch_id UUID,
  p_limit INTEGER,
  p_locked_by TEXT DEFAULT 'extract-worker'
)
RETURNS TABLE(url_id BIGINT, url TEXT, university_id UUID, kind TEXT, raw_page_id BIGINT, text_content TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT pu.id, pu.url, pu.university_id, pu.kind, pu.raw_page_id
    FROM program_urls pu
    WHERE pu.batch_id = p_batch_id
      AND pu.status = 'fetched'
      AND pu.raw_page_id IS NOT NULL
      AND (pu.lease_expires_at IS NULL OR pu.lease_expires_at < now())
    ORDER BY pu.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  updated AS (
    UPDATE program_urls pu
    SET status = 'extracting',
        locked_at = now(),
        locked_by = p_locked_by,
        lease_expires_at = now() + interval '10 minutes'
    FROM picked p
    WHERE pu.id = p.id
    RETURNING pu.id, pu.url, pu.university_id, pu.kind, pu.raw_page_id
  )
  SELECT u.id AS url_id, u.url, u.university_id, u.kind, u.raw_page_id,
         rp.text_content
  FROM updated u
  LEFT JOIN raw_pages rp ON rp.id = u.raw_page_id;
END
$$;