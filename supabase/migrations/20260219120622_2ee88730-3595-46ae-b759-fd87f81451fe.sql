
-- RPC to lock program_urls for Door2 program detail extraction
-- Only picks door2-discovered URLs (discovered_from LIKE 'door2:%')

DROP FUNCTION IF EXISTS public.rpc_lock_door2_program_urls(int, text);

CREATE OR REPLACE FUNCTION public.rpc_lock_door2_program_urls(
  p_limit int DEFAULT 5,
  p_locked_by text DEFAULT 'door2-detail'
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
    WHERE pu.status = 'pending'
      AND pu.kind = 'program'
      AND pu.discovered_from LIKE 'door2:%'
      AND pu.url NOT LIKE '%#%'  -- Skip anchor-only URLs
      AND (pu.lease_expires_at IS NULL OR pu.lease_expires_at < now())
    ORDER BY pu.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE program_urls pu
  SET 
    status = 'fetching',
    locked_by = p_locked_by,
    locked_at = now(),
    lease_expires_at = now() + interval '5 minutes'
  FROM candidates c
  WHERE pu.id = c.id
  RETURNING pu.id, pu.url, pu.university_id, pu.kind;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_lock_door2_program_urls(int, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_lock_door2_program_urls(int, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_lock_door2_program_urls(int, text) TO service_role;

NOTIFY pgrst, 'reload schema';
