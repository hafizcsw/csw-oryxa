
-- Fix rpc_admin_door2_review_queue: step_name→step_key, started_at→created_at, remove links_found
DROP FUNCTION IF EXISTS public.rpc_admin_door2_review_queue(jsonb, int, int);

CREATE OR REPLACE FUNCTION public.rpc_admin_door2_review_queue(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stage text;
  v_time_window text;
  v_search text;
  v_country text;
  v_run_id text;
  v_offset int;
  v_interval interval;
  v_result jsonb;
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

  WITH filtered AS (
    SELECT
      u.id AS university_id,
      u.name,
      u.name_en,
      u.slug,
      u.website,
      u.logo_url,
      u.uniranks_rank,
      cs.stage,
      cs.updated_at AS state_updated_at,
      cs.retry_count,
      cs.quarantine_reason,
      cs.door2_run_id,
      c.country_code,
      c.name_en AS country_name_en,
      c.name_ar AS country_name_ar,
      about_step.status AS about_status,
      logo_step.status AS logo_status,
      profile_step.status AS profile_main_status,
      programs_step.status AS programs_list_status
    FROM universities u
    JOIN uniranks_crawl_state cs ON cs.university_id = u.id::text
    LEFT JOIN countries c ON c.id = u.country_id
    LEFT JOIN LATERAL (
      SELECT sr.status FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.step_key = 'about'
      ORDER BY sr.created_at DESC LIMIT 1
    ) about_step ON true
    LEFT JOIN LATERAL (
      SELECT sr.status FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.step_key = 'logo'
      ORDER BY sr.created_at DESC LIMIT 1
    ) logo_step ON true
    LEFT JOIN LATERAL (
      SELECT sr.status FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.step_key = 'profile_main'
      ORDER BY sr.created_at DESC LIMIT 1
    ) profile_step ON true
    LEFT JOIN LATERAL (
      SELECT sr.status FROM uniranks_step_runs sr
      WHERE sr.university_id = u.id::text AND sr.step_key = 'programs_list'
      ORDER BY sr.created_at DESC LIMIT 1
    ) programs_step ON true
    WHERE
      (v_run_id IS NULL OR cs.door2_run_id = v_run_id)
      AND (v_stage IS NULL OR v_stage = '' OR cs.stage = v_stage)
      AND (v_interval IS NULL OR cs.updated_at >= now() - v_interval)
      AND (v_search IS NULL OR v_search = '' OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%')
      AND (v_country IS NULL OR v_country = '' OR c.country_code = v_country)
    ORDER BY u.uniranks_rank ASC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT COALESCE(jsonb_agg(row_to_json(f)::jsonb), '[]'::jsonb)
  INTO v_result
  FROM filtered f;

  RETURN v_result;
END;
$$;
