
-- GO-LIVE PACK: columns + RPCs (sans rpc_set_crawl_paused which already exists)

-- A1) New columns
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS uniranks_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS website_source TEXT,
  ADD COLUMN IF NOT EXISTS website_confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS website_etld1 TEXT,
  ADD COLUMN IF NOT EXISTS website_resolved_at TIMESTAMPTZ;

-- A2) Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_uni_uniranks_slug_unique 
  ON universities(uniranks_slug) WHERE uniranks_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_uni_website_etld1_unique
  ON universities(website_etld1) WHERE website_etld1 IS NOT NULL;

-- B) Backfill RPC
CREATE OR REPLACE FUNCTION public.rpc_migrate_uniranks_website_to_profile(p_limit INT DEFAULT 1000)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  WITH targets AS (
    SELECT id FROM universities
    WHERE website ILIKE '%uniranks.com%'
      AND (uniranks_profile_url IS NULL OR uniranks_profile_url = '')
    ORDER BY id LIMIT p_limit
  ),
  moved AS (
    UPDATE universities u
    SET uniranks_profile_url = u.website,
        website = NULL, website_source = NULL, website_etld1 = NULL,
        website_confidence = NULL, website_resolved_at = NULL,
        crawl_status = 'pending', crawl_stage = 0,
        crawl_error = NULL, crawl_last_attempt = NULL
    FROM targets t WHERE u.id = t.id RETURNING u.id
  )
  SELECT COUNT(*) INTO v_count FROM moved;
  RETURN jsonb_build_object('migrated_count', v_count);
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_migrate_uniranks_website_to_profile(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_migrate_uniranks_website_to_profile(INT) TO service_role;

-- C) Reset stuck locks (already exists but re-create for safety)
CREATE OR REPLACE FUNCTION public.rpc_reset_stuck_locks()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_urls INT := 0; v_unis INT := 0;
BEGIN
  UPDATE program_urls
  SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'retry' END,
      locked_at = NULL, locked_by = NULL, lease_expires_at = NULL,
      retry_at = CASE WHEN attempts < 3 THEN now() + interval '5 minutes' ELSE NULL END
  WHERE lease_expires_at < now() AND status IN ('fetching', 'extracting');
  GET DIAGNOSTICS v_urls = ROW_COUNT;
  UPDATE universities SET crawl_status = 'pending', crawl_last_attempt = NULL
  WHERE crawl_status IN ('locked', 'resolving', 'discovering')
    AND (crawl_last_attempt IS NULL OR crawl_last_attempt < now() - interval '30 minutes');
  GET DIAGNOSTICS v_unis = ROW_COUNT;
  RETURN jsonb_build_object('urls_reset', v_urls, 'universities_reset', v_unis);
END; $$;

-- D) CWUR URL Repair
CREATE OR REPLACE FUNCTION public.rpc_repair_cwur_profile_urls(p_limit INT DEFAULT 500)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  WITH targets AS (
    SELECT id FROM universities WHERE cwur_profile_url ~ 'cwur\.org\d' ORDER BY id LIMIT p_limit
  ),
  fixed AS (
    UPDATE universities u
    SET cwur_profile_url = regexp_replace(u.cwur_profile_url, 'cwur\.org(\d)', 'cwur.org/\1')
    FROM targets t WHERE u.id = t.id RETURNING u.id
  )
  SELECT COUNT(*) INTO v_count FROM fixed;
  RETURN jsonb_build_object('fixed_count', v_count);
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_repair_cwur_profile_urls(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_repair_cwur_profile_urls(INT) TO service_role;

-- E) Set university website RPC
CREATE OR REPLACE FUNCTION public.rpc_set_university_website(
  p_university_id UUID, p_website TEXT, p_source TEXT, p_etld1 TEXT, p_confidence NUMERIC DEFAULT 0.8
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing TEXT;
BEGIN
  SELECT id::text INTO v_existing FROM universities
  WHERE website_etld1 = p_etld1 AND id != p_university_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'conflict', 'conflicting_id', v_existing);
  END IF;
  UPDATE universities SET
    website = p_website, website_source = p_source, website_etld1 = p_etld1,
    website_confidence = p_confidence, website_resolved_at = now(),
    crawl_status = 'website_resolved', crawl_error = NULL
  WHERE id = p_university_id;
  RETURN jsonb_build_object('status', 'ok');
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_set_university_website(UUID, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_set_university_website(UUID, TEXT, TEXT, TEXT, NUMERIC) TO service_role;
