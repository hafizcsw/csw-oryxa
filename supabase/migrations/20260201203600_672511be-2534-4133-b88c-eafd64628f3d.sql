-- Add SKIP LOCKED RPC for proper locking
CREATE OR REPLACE FUNCTION rpc_lock_program_urls_for_fetch(
  p_batch_id uuid,
  p_limit int,
  p_locked_by text
)
RETURNS TABLE(id bigint, url text, university_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT pu.id
    FROM program_urls pu
    WHERE pu.batch_id = p_batch_id
      AND pu.status IN ('pending','retry')
      AND (pu.retry_at IS NULL OR pu.retry_at <= now())
      AND pu.locked_at IS NULL
    ORDER BY pu.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE program_urls pu
  SET locked_at = now(),
      locked_by = p_locked_by
  FROM cte
  WHERE pu.id = cte.id
  RETURNING pu.id, pu.url, pu.university_id;
END;
$$;