
-- Migration 1: New RPC rpc_get_review_countries
-- Returns country summaries with university counts matching current filters

CREATE OR REPLACE FUNCTION public.rpc_get_review_countries(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := p_filters->>'crawl_status';
  v_publish_status text := p_filters->>'publish_status';
  v_has_programs text := p_filters->>'has_programs';
  v_search text := p_filters->>'search';
  v_result jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(row_data ORDER BY (row_data->>'university_count')::int DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'country_code', u.country_code,
      'name_ar', c.name_ar,
      'name_en', c.name_en,
      'university_count', count(*)::int
    ) AS row_data
    FROM universities u
    LEFT JOIN countries c ON c.country_code = u.country_code
    WHERE u.country_code IS NOT NULL
      AND (v_status IS NULL OR u.crawl_status = v_status)
      AND (v_publish_status IS NULL OR u.publish_status = v_publish_status)
      AND (v_search IS NULL OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%' OR u.slug ILIKE '%' || v_search || '%')
      AND (v_has_programs IS NULL
        OR (v_has_programs = 'yes' AND EXISTS (SELECT 1 FROM program_draft pd WHERE pd.university_id = u.id))
        OR (v_has_programs = 'no' AND NOT EXISTS (SELECT 1 FROM program_draft pd WHERE pd.university_id = u.id))
      )
    GROUP BY u.country_code, c.name_ar, c.name_en
  ) sub;

  RETURN v_result;
END;
$$;

-- Migration 2: Update rpc_get_crawl_review_queue to add country_code filter + Door 2 fields

CREATE OR REPLACE FUNCTION public.rpc_get_crawl_review_queue(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset int := (p_page - 1) * p_page_size;
  v_status text := p_filters->>'crawl_status';
  v_publish_status text := p_filters->>'publish_status';
  v_has_programs text := p_filters->>'has_programs';
  v_search text := p_filters->>'search';
  v_country_code text := p_filters->>'country_code';
  v_total int;
  v_rows jsonb;
BEGIN
  SELECT count(*) INTO v_total
  FROM universities u
  WHERE (v_status IS NULL OR u.crawl_status = v_status)
    AND (v_publish_status IS NULL OR u.publish_status = v_publish_status)
    AND (v_country_code IS NULL OR u.country_code = v_country_code)
    AND (v_search IS NULL OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%' OR u.slug ILIKE '%' || v_search || '%')
    AND (v_has_programs IS NULL
      OR (v_has_programs = 'yes' AND EXISTS (SELECT 1 FROM program_draft pd WHERE pd.university_id = u.id))
      OR (v_has_programs = 'no' AND NOT EXISTS (SELECT 1 FROM program_draft pd WHERE pd.university_id = u.id))
    );

  SELECT coalesce(jsonb_agg(row_data), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', u.id,
      'name', u.name,
      'name_en', u.name_en,
      'slug', u.slug,
      'crawl_status', u.crawl_status,
      'publish_status', u.publish_status,
      'published_at', u.published_at,
      'website', u.website,
      'logo_url', u.logo_url,
      'uniranks_profile_url', u.uniranks_profile_url,
      'uniranks_rank', u.uniranks_rank,
      'uniranks_score', u.uniranks_score,
      'uniranks_verified', u.uniranks_verified,
      'uniranks_recognized', u.uniranks_recognized,
      'uniranks_region_label', u.uniranks_region_label,
      'uniranks_badges', u.uniranks_badges,
      'uniranks_sections_present', u.uniranks_sections_present,
      'uniranks_last_trace_id', u.uniranks_last_trace_id,
      'uniranks_snapshot_at', u.uniranks_snapshot_at,
      'uniranks_program_pages_done', u.uniranks_program_pages_done,
      'uniranks_program_pages_total', u.uniranks_program_pages_total,
      'country_code', u.country_code,
      'program_draft_count', (SELECT count(*) FROM program_draft pd WHERE pd.university_id = u.id),
      'programs_published_count', (SELECT count(*) FROM program_draft pd WHERE pd.university_id = u.id AND pd.review_status = 'published'),
      'programs_pending_count', (SELECT count(*) FROM program_draft pd WHERE pd.university_id = u.id AND pd.review_status = 'draft')
    ) AS row_data
    FROM universities u
    WHERE (v_status IS NULL OR u.crawl_status = v_status)
      AND (v_publish_status IS NULL OR u.publish_status = v_publish_status)
      AND (v_country_code IS NULL OR u.country_code = v_country_code)
      AND (v_search IS NULL OR u.name ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%' OR u.slug ILIKE '%' || v_search || '%')
      AND (v_has_programs IS NULL
        OR (v_has_programs = 'yes' AND EXISTS (SELECT 1 FROM program_draft pd WHERE pd.university_id = u.id))
        OR (v_has_programs = 'no' AND NOT EXISTS (SELECT 1 FROM program_draft pd WHERE pd.university_id = u.id))
      )
    ORDER BY u.uniranks_rank ASC NULLS LAST, u.name_en ASC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size,
    'rows', v_rows
  );
END;
$$;

-- Migration 3: Update rpc_get_university_review to add program pagination

CREATE OR REPLACE FUNCTION public.rpc_get_university_review(
  p_university_id uuid,
  p_program_page int DEFAULT 1,
  p_program_page_size int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uni jsonb;
  v_programs jsonb;
  v_programs_total int;
  v_offset int := (p_program_page - 1) * p_program_page_size;
BEGIN
  SELECT jsonb_build_object(
    'id', u.id,
    'name', u.name,
    'name_en', u.name_en,
    'slug', u.slug,
    'website', u.website,
    'logo_url', u.logo_url,
    'country_code', u.country_code,
    'crawl_status', u.crawl_status,
    'publish_status', u.publish_status,
    'published_at', u.published_at,
    'uniranks_profile_url', u.uniranks_profile_url,
    'uniranks_verified', u.uniranks_verified,
    'uniranks_recognized', u.uniranks_recognized,
    'uniranks_rank', u.uniranks_rank,
    'uniranks_score', u.uniranks_score,
    'uniranks_country_rank', u.uniranks_country_rank,
    'uniranks_region_rank', u.uniranks_region_rank,
    'uniranks_world_rank', u.uniranks_world_rank,
    'uniranks_region_label', u.uniranks_region_label,
    'uniranks_badges', u.uniranks_badges,
    'uniranks_top_buckets', u.uniranks_top_buckets,
    'uniranks_sections_present', u.uniranks_sections_present,
    'uniranks_snapshot', u.uniranks_snapshot,
    'uniranks_snapshot_at', u.uniranks_snapshot_at,
    'uniranks_snapshot_trace_id', u.uniranks_snapshot_trace_id,
    'uniranks_last_trace_id', u.uniranks_last_trace_id
  ) INTO v_uni
  FROM universities u
  WHERE u.id = p_university_id;

  IF v_uni IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Get total programs count
  SELECT count(*) INTO v_programs_total
  FROM program_draft pd
  WHERE pd.university_id = p_university_id;

  -- Get paginated programs
  SELECT coalesce(jsonb_agg(prog_row), '[]'::jsonb) INTO v_programs
  FROM (
    SELECT jsonb_build_object(
      'id', pd.id,
      'title', pd.title,
      'title_en', pd.title_en,
      'degree_level', pd.degree_level,
      'language', pd.language,
      'duration_months', pd.duration_months,
      'tuition_fee', pd.tuition_fee,
      'currency', pd.currency,
      'source_url', pd.source_url,
      'source_program_url', pd.source_program_url,
      'status', pd.status,
      'review_status', pd.review_status,
      'missing_fields', pd.missing_fields,
      'flags', pd.flags,
      'confidence_score', pd.confidence_score,
      'final_confidence', pd.final_confidence,
      'field_evidence_map', pd.field_evidence_map,
      'extracted_json', pd.extracted_json,
      'schema_version', pd.schema_version,
      'extractor_version', pd.extractor_version,
      'last_extracted_at', pd.last_extracted_at,
      'program_key', pd.program_key,
      'published_program_id', pd.published_program_id,
      'published_at', pd.published_at,
      'created_at', pd.created_at
    ) AS prog_row
    FROM program_draft pd
    WHERE pd.university_id = p_university_id
    ORDER BY pd.created_at DESC
    LIMIT p_program_page_size OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'university', v_uni,
    'programs', v_programs,
    'programs_count', v_programs_total,
    'programs_page', p_program_page,
    'programs_page_size', p_program_page_size
  );
END;
$$;
