
-- Create the clean review view (Read-path fix only, no data changes)
CREATE OR REPLACE VIEW public.door2_review_current_v1 AS
WITH ranked AS (
  SELECT
    d.*,
    ROW_NUMBER() OVER (
      PARTITION BY d.source_url
      ORDER BY d.last_extracted_at DESC NULLS LAST, d.id DESC
    ) AS rn
  FROM public.program_draft d
  WHERE d.schema_version = 'door2-detail-v1'
    AND d.source_url IS NOT NULL
    AND d.source_url != ''
    AND d.source_url NOT LIKE '%#%'
    AND d.source_url ILIKE '%uniranks.com%'
)
SELECT *
FROM ranked
WHERE rn = 1;

-- Now update rpc_admin_door2_review_countries to use only drafts from the clean view
CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_countries(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stage text;
  v_time_window text;
  v_search text;
  v_run_id text;
  v_interval interval;
  v_result jsonb;
  v_counters jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_stage := p_filters->>'stage';
  v_time_window := p_filters->>'time_window';
  v_search := p_filters->>'search';
  v_run_id := p_filters->>'run_id';

  v_interval := CASE v_time_window
    WHEN '15m' THEN interval '15 minutes'
    WHEN '1h'  THEN interval '1 hour'
    WHEN '6h'  THEN interval '6 hours'
    WHEN '24h' THEN interval '24 hours'
    ELSE NULL
  END;

  SELECT jsonb_build_object(
    'processed_15m', (SELECT count(*) FROM public.uniranks_crawl_state cs WHERE cs.updated_at >= now() - interval '15 minutes' AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id) AND EXISTS (SELECT 1 FROM public.door2_review_current_v1 rv WHERE rv.university_id::text = cs.university_id)),
    'errors_15m', (SELECT count(*) FROM public.uniranks_crawl_state cs WHERE cs.quarantine_reason IS NOT NULL AND cs.quarantined_at >= now() - interval '15 minutes' AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id)),
    'pending_total', (SELECT count(*) FROM public.uniranks_crawl_state cs WHERE cs.stage IN ('profile_pending','programs_pending') AND (v_run_id IS NULL OR cs.door2_run_id = v_run_id))
  ) INTO v_counters;

  WITH filtered AS (
    SELECT u.country_id, u.id
    FROM public.universities u
    JOIN public.uniranks_crawl_state cs ON cs.university_id = u.id::text
    WHERE
      (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
      AND (v_stage IS NULL OR v_stage = '' OR cs.stage = v_stage)
      AND (v_interval IS NULL OR cs.updated_at >= now() - v_interval)
      AND (v_search IS NULL OR v_search = '' OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%')
      AND EXISTS (
        SELECT 1 FROM public.door2_review_current_v1 rv
        WHERE rv.university_id = u.id
      )
  ),
  country_counts AS (
    SELECT c.id AS country_id, c.country_code, c.name_ar, c.name_en,
      count(f.id) AS university_count
    FROM filtered f
    JOIN public.countries c ON c.id = f.country_id
    GROUP BY c.id, c.country_code, c.name_ar, c.name_en
    ORDER BY count(f.id) DESC
  )
  SELECT jsonb_build_object(
    'counters', v_counters,
    'countries', COALESCE(jsonb_agg(row_to_json(cc)::jsonb), '[]'::jsonb)
  ) INTO v_result
  FROM country_counts cc;

  RETURN COALESCE(v_result, jsonb_build_object('counters', v_counters, 'countries', '[]'::jsonb));
END;
$$;

-- Update rpc_admin_door2_review_queue to count drafts from clean view only
CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_queue(p_filters jsonb DEFAULT '{}'::jsonb, p_page int DEFAULT 1, p_page_size int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stage text;
  v_time_window text;
  v_search text;
  v_country text;
  v_run_id text;
  v_offset int;
  v_interval interval;
  v_rows jsonb;
  v_total int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_stage := p_filters->>'stage';
  v_time_window := p_filters->>'time_window';
  v_search := p_filters->>'search';
  v_country := p_filters->>'country_code';
  v_run_id := p_filters->>'run_id';
  v_offset := (p_page - 1) * p_page_size;

  v_interval := CASE v_time_window
    WHEN '15m' THEN interval '15 minutes'
    WHEN '1h'  THEN interval '1 hour'
    WHEN '6h'  THEN interval '6 hours'
    WHEN '24h' THEN interval '24 hours'
    ELSE NULL
  END;

  SELECT count(*)
  INTO v_total
  FROM public.universities u
  JOIN public.uniranks_crawl_state cs ON cs.university_id = u.id::text
  LEFT JOIN public.countries c ON c.id = u.country_id
  WHERE
    (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
    AND (v_stage IS NULL OR v_stage = '' OR cs.stage = v_stage)
    AND (v_interval IS NULL OR cs.updated_at >= now() - v_interval)
    AND (v_search IS NULL OR v_search = '' OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%')
    AND (v_country IS NULL OR v_country = '' OR c.country_code = v_country)
    AND EXISTS (
      SELECT 1 FROM public.door2_review_current_v1 rv
      WHERE rv.university_id = u.id
    );

  WITH filtered AS (
    SELECT
      u.id::text AS id, u.name, u.name_en, u.slug, u.crawl_status, u.publish_status,
      u.website, u.logo_url, u.uniranks_rank, c.country_code,
      cs.stage AS door2_stage, cs.updated_at AS door2_updated_at,
      cs.retry_count AS door2_retries, cs.quarantine_reason AS door2_quarantine,
      cs.door2_run_id,
      about_step.status AS about_status, logo_step.status AS logo_status,
      profile_step.status AS profile_main_status, programs_step.status AS programs_list_status,
      COALESCE((SELECT count(*) FROM public.door2_review_current_v1 rv WHERE rv.university_id = u.id), 0)::int AS program_draft_count,
      COALESCE((SELECT count(*) FROM public.programs p WHERE p.university_id = u.id AND p.is_active = true), 0)::int AS programs_published_count,
      0 AS program_links_count
    FROM public.universities u
    JOIN public.uniranks_crawl_state cs ON cs.university_id = u.id::text
    LEFT JOIN public.countries c ON c.id = u.country_id
    LEFT JOIN LATERAL (SELECT sr.status FROM public.uniranks_step_runs sr WHERE sr.university_id = u.id::text AND sr.step_key = 'about' ORDER BY sr.created_at DESC LIMIT 1) about_step ON true
    LEFT JOIN LATERAL (SELECT sr.status FROM public.uniranks_step_runs sr WHERE sr.university_id = u.id::text AND sr.step_key = 'logo' ORDER BY sr.created_at DESC LIMIT 1) logo_step ON true
    LEFT JOIN LATERAL (SELECT sr.status FROM public.uniranks_step_runs sr WHERE sr.university_id = u.id::text AND sr.step_key = 'profile_main' ORDER BY sr.created_at DESC LIMIT 1) profile_step ON true
    LEFT JOIN LATERAL (SELECT sr.status FROM public.uniranks_step_runs sr WHERE sr.university_id = u.id::text AND sr.step_key = 'programs_list' ORDER BY sr.created_at DESC LIMIT 1) programs_step ON true
    WHERE
      (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
      AND (v_stage IS NULL OR v_stage = '' OR cs.stage = v_stage)
      AND (v_interval IS NULL OR cs.updated_at >= now() - v_interval)
      AND (v_search IS NULL OR v_search = '' OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%')
      AND (v_country IS NULL OR v_country = '' OR c.country_code = v_country)
      AND EXISTS (
        SELECT 1 FROM public.door2_review_current_v1 rv
        WHERE rv.university_id = u.id
      )
    ORDER BY u.uniranks_rank ASC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT COALESCE(jsonb_agg(row_to_json(f)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM filtered f;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

-- Update unpublished draft IDs to also use the clean view
CREATE OR REPLACE FUNCTION public.rpc_admin_door2_unpublished_draft_ids(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT rv.id
  FROM public.door2_review_current_v1 rv
  WHERE rv.review_status IS DISTINCT FROM 'published'
  ORDER BY rv.id;
END;
$$;
