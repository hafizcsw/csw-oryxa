-- Must DROP first because return type is changing from SETOF universities → TABLE(university_id uuid)
DROP FUNCTION IF EXISTS public.rpc_lock_universities_for_batch(integer, text);

CREATE FUNCTION public.rpc_lock_universities_for_batch(p_limit integer, p_worker text)
 RETURNS TABLE(university_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE universities u SET crawl_status = 'locked', crawl_stage = 1, crawl_last_attempt = now()
  FROM (
    SELECT id FROM universities
    WHERE crawl_status IN ('pending', 'idle') AND is_active = true AND website IS NOT NULL
    ORDER BY ranking ASC NULLS LAST LIMIT p_limit FOR UPDATE SKIP LOCKED
  ) sub WHERE u.id = sub.id
  RETURNING u.id AS university_id;
END;
$$;

-- Re-secure
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_batch(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_batch(integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_batch(integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_batch(integer, text) TO service_role;