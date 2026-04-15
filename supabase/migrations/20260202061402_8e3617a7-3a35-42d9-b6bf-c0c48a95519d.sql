-- Add missing locking RPCs for all pipeline stages

-- 1. RPC for locking universities during batch creation
CREATE OR REPLACE FUNCTION rpc_lock_universities_for_batch(
  p_limit INT,
  p_needs_website BOOLEAN DEFAULT true
)
RETURNS TABLE(university_id UUID, cwur_profile_url TEXT, website TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT u.id
    FROM universities u
    WHERE u.cwur_profile_url IS NOT NULL
      AND (NOT p_needs_website OR u.website IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM crawl_batch_universities cbu
        JOIN crawl_batches cb ON cbu.batch_id = cb.id
        WHERE cbu.university_id = u.id
          AND cb.status NOT IN ('done', 'failed')
      )
    ORDER BY u.cwur_world_rank ASC NULLS LAST
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  SELECT u.id, u.cwur_profile_url, u.website
  FROM universities u
  JOIN cte ON u.id = cte.id;
END;
$$;

-- 2. RPC for locking universities during website resolution
CREATE OR REPLACE FUNCTION rpc_lock_universities_for_website_resolution(
  p_batch_id UUID,
  p_limit INT
)
RETURNS TABLE(university_id UUID, cwur_profile_url TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT u.id
    FROM universities u
    JOIN crawl_batch_universities cbu ON cbu.university_id = u.id
    WHERE cbu.batch_id = p_batch_id
      AND u.website IS NULL
      AND u.cwur_profile_url IS NOT NULL
      AND (u.crawl_status IS NULL OR u.crawl_status = 'pending')
    ORDER BY u.id
    FOR UPDATE OF u SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE universities u
  SET crawl_status = 'resolving',
      crawl_last_attempt = NOW()
  FROM cte
  WHERE u.id = cte.id
  RETURNING u.id, u.cwur_profile_url;
END;
$$;

-- 3. RPC for locking universities during program discovery
CREATE OR REPLACE FUNCTION rpc_lock_universities_for_discovery(
  p_batch_id UUID,
  p_limit INT
)
RETURNS TABLE(university_id UUID, website TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT u.id
    FROM universities u
    JOIN crawl_batch_universities cbu ON cbu.university_id = u.id
    WHERE cbu.batch_id = p_batch_id
      AND u.website IS NOT NULL
      AND u.crawl_status IN ('website_resolved', 'pending')
    ORDER BY u.id
    FOR UPDATE OF u SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE universities u
  SET crawl_status = 'discovering'
  FROM cte
  WHERE u.id = cte.id
  RETURNING u.id, u.website;
END;
$$;

-- 4. RPC for locking program_urls during extraction (prevents duplicate drafts)
CREATE OR REPLACE FUNCTION rpc_lock_urls_for_extraction(
  p_batch_id UUID,
  p_limit INT
)
RETURNS TABLE(
  url_id BIGINT, 
  url TEXT, 
  university_id UUID,
  raw_page_id BIGINT,
  text_content TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT pu.id
    FROM program_urls pu
    WHERE pu.batch_id = p_batch_id
      AND pu.status = 'fetched'
      AND pu.raw_page_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM program_draft pd
        WHERE pd.source_program_url = pu.url
          AND pd.university_id = pu.university_id
      )
      AND pu.locked_at IS NULL
    ORDER BY pu.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE program_urls pu
  SET locked_at = NOW(),
      locked_by = 'extract-worker'
  FROM cte
  WHERE pu.id = cte.id
  RETURNING pu.id, pu.url, pu.university_id, pu.raw_page_id,
    (SELECT rp.text_content FROM raw_pages rp WHERE rp.id = pu.raw_page_id);
END;
$$;

-- 5. Fix the fetch RPC to also return raw_page data properly
CREATE OR REPLACE FUNCTION rpc_lock_program_urls_for_fetch(
  p_batch_id UUID,
  p_limit INT,
  p_locked_by TEXT
)
RETURNS TABLE(id BIGINT, url TEXT, university_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT pu.id
    FROM program_urls pu
    WHERE pu.batch_id = p_batch_id
      AND pu.status IN ('pending', 'retry')
      AND (pu.retry_at IS NULL OR pu.retry_at <= NOW())
      AND pu.locked_at IS NULL
    ORDER BY pu.id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE program_urls pu
  SET locked_at = NOW(),
      locked_by = p_locked_by
  FROM cte
  WHERE pu.id = cte.id
  RETURNING pu.id, pu.url, pu.university_id;
END;
$$;