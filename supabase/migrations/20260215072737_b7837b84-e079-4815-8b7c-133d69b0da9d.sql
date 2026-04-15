
-- Fix: rpc_lock_universities_for_discovery — return TABLE with explicit aliases
-- Edge Function reads uni.university_id and uni.website
DROP FUNCTION IF EXISTS public.rpc_lock_universities_for_discovery(integer, text);

CREATE OR REPLACE FUNCTION public.rpc_lock_universities_for_discovery(
  p_limit INTEGER,
  p_worker TEXT
)
RETURNS TABLE(university_id UUID, website TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT u.id, u.website
    FROM universities u
    WHERE u.is_active = true
      AND u.website IS NOT NULL AND btrim(u.website) <> ''
      AND COALESCE(u.crawl_status, 'pending') IN ('pending', 'locked')
    ORDER BY u.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE universities u
  SET crawl_status = 'discovering',
      crawl_last_attempt = now()
  FROM picked p
  WHERE u.id = p.id
  RETURNING u.id AS university_id, u.website;
END $$;

-- Fix: rpc_lock_universities_for_website_resolution — same alias fix
DROP FUNCTION IF EXISTS public.rpc_lock_universities_for_website_resolution(integer, text);

CREATE OR REPLACE FUNCTION public.rpc_lock_universities_for_website_resolution(
  p_limit INTEGER,
  p_worker TEXT
)
RETURNS TABLE(university_id UUID, cwur_profile_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT u.id
    FROM universities u
    WHERE u.is_active = true
      AND (u.website IS NULL OR btrim(u.website) = '')
      AND COALESCE(u.crawl_status, 'pending') = 'pending'
    ORDER BY u.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE universities u
  SET crawl_status = 'resolving',
      crawl_last_attempt = now()
  FROM picked p
  WHERE u.id = p.id
  RETURNING u.id AS university_id, u.cwur_profile_url;
END $$;

-- Re-apply security for both
REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_discovery(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_discovery(INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_lock_universities_for_website_resolution(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_website_resolution(INTEGER, TEXT) TO service_role;

-- Reset the university we just locked so we can retry
UPDATE universities
SET crawl_status = 'pending', crawl_last_attempt = NULL
WHERE id = 'e6cd6056-a437-497e-9ac4-ad5d48f75a72';
