
-- Fix return type: program_urls.id is bigint, not uuid
DROP FUNCTION IF EXISTS rpc_lock_door2_program_urls(int, text);

CREATE OR REPLACE FUNCTION rpc_lock_door2_program_urls(
  p_limit int DEFAULT 3,
  p_locked_by text DEFAULT 'unknown'
)
RETURNS TABLE(id bigint, url text, university_id uuid, kind text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT pu.id
    FROM program_urls pu
    WHERE pu.status IN ('pending', 'retry', 'fetched')
      AND pu.kind = 'program'
      AND pu.discovered_from LIKE 'door2:%'
      AND pu.url NOT LIKE '%#%'
      AND (pu.lease_expires_at IS NULL OR pu.lease_expires_at < now())
    ORDER BY 
      CASE pu.status 
        WHEN 'pending' THEN 1 
        WHEN 'fetched' THEN 2 
        WHEN 'retry' THEN 3 
      END,
      pu.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE program_urls pu
  SET 
    status = 'fetching',
    locked_by = p_locked_by,
    locked_at = now(),
    lease_expires_at = now() + interval '5 minutes',
    attempts = COALESCE(pu.attempts, 0) + 1
  FROM candidates c
  WHERE pu.id = c.id
  RETURNING pu.id, pu.url, pu.university_id, pu.kind;
END;
$$;

NOTIFY pgrst, 'reload schema';
