
-- =============================================
-- Door 2 Review Console: Additive DB Changes
-- =============================================

-- 1) Universities: add publish tracking columns
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS publish_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS publish_trace_id text;

-- 2) program_draft: add review tracking columns
ALTER TABLE public.program_draft
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS publish_trace_id text;

-- 3) Index for review queue filtering
CREATE INDEX IF NOT EXISTS idx_universities_publish_status ON public.universities (publish_status);
CREATE INDEX IF NOT EXISTS idx_universities_crawl_status ON public.universities (crawl_status);
CREATE INDEX IF NOT EXISTS idx_program_draft_review_status ON public.program_draft (review_status);
CREATE INDEX IF NOT EXISTS idx_program_draft_university_id ON public.program_draft (university_id);

-- =============================================
-- 4) RPC: rpc_get_crawl_review_queue
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_get_crawl_review_queue(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50
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
  v_total int;
  v_rows jsonb;
BEGIN
  -- Count total matching
  SELECT count(*) INTO v_total
  FROM universities u
  WHERE (v_status IS NULL OR u.crawl_status = v_status)
    AND (v_publish_status IS NULL OR u.publish_status = v_publish_status)
    AND (v_search IS NULL OR u.name_ar ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%' OR u.slug ILIKE '%' || v_search || '%')
    AND (v_has_programs IS NULL
      OR (v_has_programs = 'yes' AND EXISTS (SELECT 1 FROM program_draft pd WHERE pd.university_id = u.id))
      OR (v_has_programs = 'no' AND NOT EXISTS (SELECT 1 FROM program_draft pd WHERE pd.university_id = u.id))
    );

  -- Get rows with program counts
  SELECT coalesce(jsonb_agg(row_data), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', u.id,
      'name_ar', u.name_ar,
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
      'country_code', u.country_code,
      'program_draft_count', (SELECT count(*) FROM program_draft pd WHERE pd.university_id = u.id),
      'programs_published_count', (SELECT count(*) FROM program_draft pd WHERE pd.university_id = u.id AND pd.review_status = 'published'),
      'programs_pending_count', (SELECT count(*) FROM program_draft pd WHERE pd.university_id = u.id AND pd.review_status = 'draft')
    ) AS row_data
    FROM universities u
    WHERE (v_status IS NULL OR u.crawl_status = v_status)
      AND (v_publish_status IS NULL OR u.publish_status = v_publish_status)
      AND (v_search IS NULL OR u.name_ar ILIKE '%' || v_search || '%' OR u.name_en ILIKE '%' || v_search || '%' OR u.slug ILIKE '%' || v_search || '%')
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

-- =============================================
-- 5) RPC: rpc_get_university_review
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_get_university_review(p_university_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uni jsonb;
  v_programs jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', u.id,
    'name_ar', u.name_ar,
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

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
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
    )
    ORDER BY pd.created_at DESC
  ), '[]'::jsonb) INTO v_programs
  FROM program_draft pd
  WHERE pd.university_id = p_university_id;

  RETURN jsonb_build_object(
    'university', v_uni,
    'programs', v_programs,
    'programs_count', jsonb_array_length(v_programs)
  );
END;
$$;

-- =============================================
-- 6) RPC: rpc_publish_university
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_publish_university(
  p_university_id uuid,
  p_options jsonb DEFAULT '{}'::jsonb,
  p_trace_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_published_count int := 0;
  v_skipped_count int := 0;
  v_draft record;
  v_only_eligible boolean := coalesce((p_options->>'only_eligible')::boolean, true);
  v_program_ids uuid[];
BEGIN
  -- Check admin
  IF NOT public.is_admin(v_user_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  -- Get selected program IDs or all
  IF p_options ? 'program_draft_ids' THEN
    SELECT array_agg(val::uuid) INTO v_program_ids
    FROM jsonb_array_elements_text(p_options->'program_draft_ids') val;
  END IF;

  -- Publish each eligible draft
  FOR v_draft IN
    SELECT pd.*
    FROM program_draft pd
    WHERE pd.university_id = p_university_id
      AND pd.review_status != 'published'
      AND (v_program_ids IS NULL OR pd.id = ANY(v_program_ids))
  LOOP
    -- Skip if only_eligible and missing critical fields
    IF v_only_eligible AND (v_draft.title IS NULL OR v_draft.degree_level IS NULL) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Update draft status
    UPDATE program_draft
    SET review_status = 'published',
        published_at = now(),
        published_by = v_user_id,
        publish_trace_id = p_trace_id
    WHERE id = v_draft.id;

    v_published_count := v_published_count + 1;
  END LOOP;

  -- Update university publish status
  UPDATE universities
  SET publish_status = 'published',
      published_at = now(),
      published_by = v_user_id,
      publish_trace_id = p_trace_id
  WHERE id = p_university_id;

  -- Log telemetry
  INSERT INTO pipeline_health_events (pipeline, event_type, details_json)
  VALUES ('crawl_review', 'publish_university', jsonb_build_object(
    'trace_id', p_trace_id,
    'university_id', p_university_id,
    'published_count', v_published_count,
    'skipped_count', v_skipped_count,
    'actor_id', v_user_id
  ));

  RETURN jsonb_build_object(
    'ok', true,
    'university_id', p_university_id,
    'published_count', v_published_count,
    'skipped_count', v_skipped_count
  );
END;
$$;

-- =============================================
-- 7) RPC: rpc_publish_programs
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_publish_programs(
  p_program_draft_ids bigint[],
  p_trace_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_published_count int := 0;
BEGIN
  IF NOT public.is_admin(v_user_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  UPDATE program_draft
  SET review_status = 'published',
      published_at = now(),
      published_by = v_user_id,
      publish_trace_id = p_trace_id
  WHERE id = ANY(p_program_draft_ids)
    AND review_status != 'published';

  GET DIAGNOSTICS v_published_count = ROW_COUNT;

  INSERT INTO pipeline_health_events (pipeline, event_type, details_json)
  VALUES ('crawl_review', 'publish_programs', jsonb_build_object(
    'trace_id', p_trace_id,
    'program_draft_ids_count', array_length(p_program_draft_ids, 1),
    'published_count', v_published_count,
    'actor_id', v_user_id
  ));

  RETURN jsonb_build_object('ok', true, 'published_count', v_published_count);
END;
$$;

-- =============================================
-- 8) RPC: rpc_set_review_status
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_set_review_status(
  p_target_type text,
  p_ids text[],
  p_status text,
  p_trace_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated int := 0;
BEGIN
  IF NOT public.is_admin(v_user_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  IF p_status NOT IN ('draft', 'approved', 'published', 'rejected', 'needs_review') THEN
    RETURN jsonb_build_object('error', 'invalid_status');
  END IF;

  IF p_target_type = 'university' THEN
    UPDATE universities
    SET publish_status = p_status
    WHERE id = ANY(p_ids::uuid[]);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSIF p_target_type = 'program_draft' THEN
    UPDATE program_draft
    SET review_status = p_status
    WHERE id = ANY(p_ids::bigint[]);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSE
    RETURN jsonb_build_object('error', 'invalid_target_type');
  END IF;

  INSERT INTO pipeline_health_events (pipeline, event_type, details_json)
  VALUES ('crawl_review', 'set_review_status', jsonb_build_object(
    'trace_id', p_trace_id,
    'target_type', p_target_type,
    'ids_count', array_length(p_ids, 1),
    'new_status', p_status,
    'updated_count', v_updated,
    'actor_id', v_user_id
  ));

  RETURN jsonb_build_object('ok', true, 'updated_count', v_updated);
END;
$$;
