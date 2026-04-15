CREATE OR REPLACE FUNCTION public.rpc_lock_door2_program_urls(
  p_limit integer DEFAULT 48,
  p_locked_by text DEFAULT 'runner'
)
RETURNS TABLE(id bigint, url text, university_id uuid, kind text)
LANGUAGE plpgsql
SECURITY DEFINER
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
        WHEN 'fetched' THEN 1   -- extraction only, fastest
        WHEN 'pending' THEN 2   -- needs fetch + extract
        WHEN 'retry' THEN 3     -- backoff candidates
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