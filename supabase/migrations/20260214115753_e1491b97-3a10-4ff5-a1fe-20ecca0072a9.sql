
-- ============================================================
-- PHASE A (RETRY): Drop old RPCs with exact signatures, then recreate
-- Tables/columns already applied in previous partial run (IF NOT EXISTS)
-- ============================================================

-- Ensure operational tables exist (may already exist from partial run)
CREATE TABLE IF NOT EXISTS public.crawl_domain_policies (
  host TEXT PRIMARY KEY,
  robots_respected BOOLEAN DEFAULT true,
  user_agent TEXT,
  max_rps NUMERIC DEFAULT 0.2,
  crawl_delay_seconds INT DEFAULT 5,
  allowed_paths TEXT[],
  blocked_paths TEXT[],
  requires_render BOOLEAN DEFAULT false,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.crawl_domain_policies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "domain_policies_admin_read" ON public.crawl_domain_policies FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "domain_policies_admin_write" ON public.crawl_domain_policies FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.fx_rates_daily (
  rate_date DATE NOT NULL,
  base TEXT NOT NULL DEFAULT 'USD',
  quote TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  source TEXT,
  captured_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (rate_date, base, quote)
);
ALTER TABLE public.fx_rates_daily ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "fx_rates_public_read" ON public.fx_rates_daily FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "fx_rates_admin_write" ON public.fx_rates_daily FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.pipeline_health_events (
  id BIGSERIAL PRIMARY KEY,
  pipeline TEXT NOT NULL,
  batch_id UUID,
  event_type TEXT NOT NULL,
  reason TEXT,
  details_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_health_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "health_events_admin_read" ON public.pipeline_health_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "health_events_admin_write" ON public.pipeline_health_events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fix program_draft RLS (may already be done)
DROP POLICY IF EXISTS "draft_read_admin2" ON public.program_draft;
DROP POLICY IF EXISTS "draft_write_admin2" ON public.program_draft;
DO $$ BEGIN
  CREATE POLICY "draft_read_admin" ON public.program_draft FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "draft_insert_admin" ON public.program_draft FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "draft_update_admin" ON public.program_draft FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "draft_delete_admin" ON public.program_draft FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- DROP OLD RPCs (exact old signatures)
-- ============================================================
DROP FUNCTION IF EXISTS public.rpc_lock_universities_for_batch(integer, boolean);
DROP FUNCTION IF EXISTS public.rpc_lock_universities_for_batch(integer, text);
DROP FUNCTION IF EXISTS public.rpc_lock_universities_for_website_resolution(uuid, integer);
DROP FUNCTION IF EXISTS public.rpc_lock_universities_for_website_resolution(integer, text);
DROP FUNCTION IF EXISTS public.rpc_lock_universities_for_discovery(uuid, integer);
DROP FUNCTION IF EXISTS public.rpc_lock_universities_for_discovery(integer, text);
DROP FUNCTION IF EXISTS public.rpc_upsert_program_url(uuid, uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_upsert_program_url(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_lock_program_urls_for_fetch(uuid, integer, text);
DROP FUNCTION IF EXISTS public.rpc_lock_urls_for_extraction(uuid, integer);
DROP FUNCTION IF EXISTS public.rpc_lock_urls_for_extraction(uuid, integer, text);
DROP FUNCTION IF EXISTS public.rpc_increment_batch_programs_discovered(uuid, integer);
DROP FUNCTION IF EXISTS public.rpc_increment_batch_programs_extracted(uuid, integer);
DROP FUNCTION IF EXISTS public.rpc_seed_program_urls_from_gap(uuid, integer);
DROP FUNCTION IF EXISTS public.rpc_publish_program_batch(uuid);
DROP FUNCTION IF EXISTS public.rpc_publish_program_batch(uuid, text);
DROP FUNCTION IF EXISTS public.rpc_crawl_batch_summary(uuid);
DROP FUNCTION IF EXISTS public.rpc_reset_stuck_locks();

-- ============================================================
-- CREATE ALL 12 RPCs (clean)
-- ============================================================

-- 1) rpc_lock_universities_for_batch
CREATE FUNCTION public.rpc_lock_universities_for_batch(p_limit INT, p_worker TEXT)
RETURNS SETOF public.universities
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE universities u SET crawl_status = 'locked', crawl_stage = 1, crawl_last_attempt = now()
  FROM (
    SELECT id FROM universities
    WHERE crawl_status IN ('pending', 'idle') AND is_active = true AND website IS NOT NULL
    ORDER BY ranking ASC NULLS LAST LIMIT p_limit FOR UPDATE SKIP LOCKED
  ) sub WHERE u.id = sub.id RETURNING u.*;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_lock_universities_for_batch(INT, TEXT) FROM PUBLIC;

-- 2) rpc_lock_universities_for_website_resolution
CREATE FUNCTION public.rpc_lock_universities_for_website_resolution(p_limit INT, p_worker TEXT)
RETURNS SETOF public.universities
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE universities u SET crawl_status = 'resolving', crawl_last_attempt = now()
  FROM (
    SELECT id FROM universities
    WHERE (website IS NULL OR website = '') AND is_active = true AND cwur_profile_url IS NOT NULL
    ORDER BY ranking ASC NULLS LAST LIMIT p_limit FOR UPDATE SKIP LOCKED
  ) sub WHERE u.id = sub.id RETURNING u.*;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_lock_universities_for_website_resolution(INT, TEXT) FROM PUBLIC;

-- 3) rpc_lock_universities_for_discovery
CREATE FUNCTION public.rpc_lock_universities_for_discovery(p_limit INT, p_worker TEXT)
RETURNS SETOF public.universities
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE universities u SET crawl_status = 'discovering', crawl_last_attempt = now()
  FROM (
    SELECT id FROM universities WHERE crawl_status = 'locked' AND website IS NOT NULL
    ORDER BY ranking ASC NULLS LAST LIMIT p_limit FOR UPDATE SKIP LOCKED
  ) sub WHERE u.id = sub.id RETURNING u.*;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_lock_universities_for_discovery(INT, TEXT) FROM PUBLIC;

-- 4) rpc_upsert_program_url
CREATE FUNCTION public.rpc_upsert_program_url(
  p_batch_id UUID, p_university_id UUID, p_url TEXT, p_kind TEXT DEFAULT 'program', p_discovered_from TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_canonical TEXT; v_id BIGINT;
BEGIN
  v_canonical := lower(trim(p_url));
  v_canonical := regexp_replace(v_canonical, '[?&](utm_[a-z_]+=[^&]*)', '', 'gi');
  v_canonical := regexp_replace(v_canonical, '/$', '');
  v_canonical := regexp_replace(v_canonical, '\?$', '');
  INSERT INTO program_urls (batch_id, university_id, url, canonical_url, kind, discovered_from, status)
  VALUES (p_batch_id, p_university_id, p_url, v_canonical, p_kind, p_discovered_from, 'pending')
  ON CONFLICT (university_id, kind, canonical_url) DO UPDATE SET
    batch_id = COALESCE(EXCLUDED.batch_id, program_urls.batch_id),
    discovered_from = COALESCE(EXCLUDED.discovered_from, program_urls.discovered_from)
    WHERE program_urls.status = 'pending'
  RETURNING id INTO v_id;
  RETURN COALESCE(v_id, 0);
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_upsert_program_url(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;

-- 5) rpc_lock_program_urls_for_fetch
CREATE FUNCTION public.rpc_lock_program_urls_for_fetch(p_batch_id UUID, p_limit INT, p_locked_by TEXT)
RETURNS TABLE(id BIGINT, url TEXT, university_id UUID, kind TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE program_urls pu SET status = 'fetching', locked_at = now(), locked_by = p_locked_by,
    lease_expires_at = now() + interval '10 minutes', attempts = COALESCE(attempts, 0) + 1
  FROM (
    SELECT program_urls.id FROM program_urls
    WHERE batch_id = p_batch_id AND status IN ('pending', 'retry')
      AND (retry_at IS NULL OR retry_at <= now())
      AND (lease_expires_at IS NULL OR lease_expires_at < now())
    ORDER BY CASE WHEN status = 'retry' THEN 0 ELSE 1 END, created_at ASC
    LIMIT p_limit FOR UPDATE SKIP LOCKED
  ) sub WHERE pu.id = sub.id
  RETURNING pu.id, pu.url, pu.university_id, pu.kind;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_lock_program_urls_for_fetch(UUID, INT, TEXT) FROM PUBLIC;

-- 6) rpc_lock_urls_for_extraction
CREATE FUNCTION public.rpc_lock_urls_for_extraction(p_batch_id UUID, p_limit INT, p_locked_by TEXT)
RETURNS TABLE(id BIGINT, url TEXT, university_id UUID, kind TEXT, raw_page_id BIGINT, text_content TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE program_urls pu SET status = 'extracting', locked_at = now(), locked_by = p_locked_by,
    lease_expires_at = now() + interval '10 minutes'
  FROM (
    SELECT program_urls.id FROM program_urls
    WHERE batch_id = p_batch_id AND status = 'fetched' AND raw_page_id IS NOT NULL
      AND (lease_expires_at IS NULL OR lease_expires_at < now())
    ORDER BY created_at ASC LIMIT p_limit FOR UPDATE SKIP LOCKED
  ) sub WHERE pu.id = sub.id
  RETURNING pu.id, pu.url, pu.university_id, pu.kind, pu.raw_page_id,
    (SELECT rp.text_content FROM raw_pages rp WHERE rp.id = pu.raw_page_id);
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_lock_urls_for_extraction(UUID, INT, TEXT) FROM PUBLIC;

-- 7) rpc_increment_batch_programs_discovered
CREATE FUNCTION public.rpc_increment_batch_programs_discovered(p_batch_id UUID, p_delta INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE crawl_batches SET programs_discovered = COALESCE(programs_discovered, 0) + p_delta WHERE id = p_batch_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_increment_batch_programs_discovered(UUID, INT) FROM PUBLIC;

-- 8) rpc_increment_batch_programs_extracted
CREATE FUNCTION public.rpc_increment_batch_programs_extracted(p_batch_id UUID, p_delta INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE crawl_batches SET programs_extracted = COALESCE(programs_extracted, 0) + p_delta WHERE id = p_batch_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_increment_batch_programs_extracted(UUID, INT) FROM PUBLIC;

-- 9) rpc_seed_program_urls_from_gap
CREATE FUNCTION public.rpc_seed_program_urls_from_gap(p_batch_id UUID, p_limit INT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT := 0;
BEGIN
  INSERT INTO program_urls (batch_id, university_id, url, canonical_url, kind, discovered_from, status)
  SELECT p_batch_id, pd.university_id, pd.source_url, lower(trim(pd.source_url)), 'program', 'gap_seed', 'pending'
  FROM program_draft pd
  WHERE pd.batch_id = p_batch_id AND pd.source_url IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM program_urls pu WHERE pu.university_id = pd.university_id
        AND pu.canonical_url = lower(trim(pd.source_url)) AND pu.kind = 'program'
    )
  LIMIT p_limit ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_seed_program_urls_from_gap(UUID, INT) FROM PUBLIC;

-- 10) rpc_publish_program_batch
CREATE FUNCTION public.rpc_publish_program_batch(p_batch_id UUID)
RETURNS TABLE(published_count INT, skipped_count INT, error_count INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_published INT := 0; v_skipped INT := 0; v_errors INT := 0; rec RECORD;
BEGIN
  FOR rec IN SELECT pd.* FROM program_draft pd WHERE pd.batch_id = p_batch_id AND pd.approval_tier = 'auto' AND pd.status = 'verified'
  LOOP
    BEGIN
      INSERT INTO programs (
        university_id, title, degree_level, duration_months,
        tuition_usd_min, tuition_usd_max, tuition_basis, tuition_scope,
        languages, study_mode, intake_months, city,
        source_program_url, content_hash, fingerprint,
        publish_status, is_active, published
      ) VALUES (
        rec.university_id, rec.title, rec.degree_level, rec.duration_months,
        (rec.extracted_json->>'tuition_usd_min')::NUMERIC,
        (rec.extracted_json->>'tuition_usd_max')::NUMERIC,
        rec.extracted_json->>'tuition_basis',
        rec.extracted_json->>'tuition_scope',
        COALESCE(rec.extracted_json->'languages', '["EN"]'::jsonb)::TEXT[],
        COALESCE(rec.extracted_json->>'study_mode', 'on_campus'),
        rec.intake_months,
        (SELECT u.city FROM universities u WHERE u.id = rec.university_id),
        rec.source_url, rec.content_hash, rec.program_key,
        'published', true, true
      ) ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
      DO UPDATE SET title = EXCLUDED.title, degree_level = EXCLUDED.degree_level,
        duration_months = EXCLUDED.duration_months, tuition_usd_min = EXCLUDED.tuition_usd_min,
        tuition_usd_max = EXCLUDED.tuition_usd_max, tuition_basis = EXCLUDED.tuition_basis,
        tuition_scope = EXCLUDED.tuition_scope, languages = EXCLUDED.languages,
        study_mode = EXCLUDED.study_mode, intake_months = EXCLUDED.intake_months,
        source_program_url = EXCLUDED.source_program_url, content_hash = EXCLUDED.content_hash,
        updated_at = now();
      UPDATE program_draft SET status = 'published',
        published_program_id = (SELECT id FROM programs WHERE fingerprint = rec.program_key LIMIT 1)
      WHERE id = rec.id;
      v_published := v_published + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO ingest_errors (pipeline, batch_id, entity_hint, source_url, fingerprint, stage, reason, details_json)
      VALUES ('crawl_pipeline', p_batch_id, 'program', rec.source_url, rec.program_key, 'publish',
              'db_error', jsonb_build_object('message', SQLERRM, 'sqlstate', SQLSTATE));
      v_errors := v_errors + 1;
    END;
  END LOOP;
  SELECT COUNT(*) INTO v_skipped FROM program_draft
  WHERE batch_id = p_batch_id AND (approval_tier != 'auto' OR status != 'verified');
  UPDATE crawl_batches SET programs_published = COALESCE(programs_published, 0) + v_published,
    status = 'published', finished_at = now() WHERE id = p_batch_id;
  RETURN QUERY SELECT v_published, v_skipped, v_errors;
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_publish_program_batch(UUID) FROM PUBLIC;

-- 11) rpc_crawl_batch_summary
CREATE FUNCTION public.rpc_crawl_batch_summary(p_batch_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'batch_id', cb.id, 'status', cb.status,
    'universities_count', cb.universities_count,
    'programs_discovered', cb.programs_discovered,
    'programs_extracted', cb.programs_extracted,
    'programs_published', cb.programs_published,
    'urls', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM program_urls WHERE batch_id = p_batch_id),
      'pending', (SELECT COUNT(*) FROM program_urls WHERE batch_id = p_batch_id AND status = 'pending'),
      'fetched', (SELECT COUNT(*) FROM program_urls WHERE batch_id = p_batch_id AND status = 'fetched'),
      'failed', (SELECT COUNT(*) FROM program_urls WHERE batch_id = p_batch_id AND status = 'failed'),
      'retry', (SELECT COUNT(*) FROM program_urls WHERE batch_id = p_batch_id AND status = 'retry')
    ),
    'drafts', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM program_draft WHERE batch_id = p_batch_id),
      'pending', (SELECT COUNT(*) FROM program_draft WHERE batch_id = p_batch_id AND status = 'pending'),
      'verified', (SELECT COUNT(*) FROM program_draft WHERE batch_id = p_batch_id AND status = 'verified'),
      'published', (SELECT COUNT(*) FROM program_draft WHERE batch_id = p_batch_id AND status = 'published')
    ),
    'errors', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM ingest_errors WHERE batch_id = p_batch_id),
      'by_stage', (SELECT COALESCE(jsonb_object_agg(stage, cnt), '{}'::jsonb) FROM (
        SELECT stage, COUNT(*) as cnt FROM ingest_errors WHERE batch_id = p_batch_id GROUP BY stage
      ) s)
    ),
    'created_at', cb.created_at, 'started_at', cb.started_at, 'finished_at', cb.finished_at
  ) INTO v_result FROM crawl_batches cb WHERE cb.id = p_batch_id;
  RETURN COALESCE(v_result, '{}'::jsonb);
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_crawl_batch_summary(UUID) FROM PUBLIC;

-- 12) rpc_reset_stuck_locks
CREATE FUNCTION public.rpc_reset_stuck_locks()
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
    AND crawl_last_attempt < now() - interval '30 minutes';
  GET DIAGNOSTICS v_unis = ROW_COUNT;
  RETURN jsonb_build_object('urls_reset', v_urls, 'universities_reset', v_unis);
END; $$;
REVOKE EXECUTE ON FUNCTION public.rpc_reset_stuck_locks() FROM PUBLIC;

-- Grant execute to authenticated for all RPCs
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_batch(INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_website_resolution(INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_universities_for_discovery(INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_upsert_program_url(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_program_urls_for_fetch(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_urls_for_extraction(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_increment_batch_programs_discovered(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_increment_batch_programs_extracted(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_seed_program_urls_from_gap(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_publish_program_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_crawl_batch_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reset_stuck_locks() TO authenticated;
