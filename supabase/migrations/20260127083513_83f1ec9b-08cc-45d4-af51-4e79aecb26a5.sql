-- ============================================
-- PHASE 1-3: Complete RPC Fix for CRM Integration
-- Fixes: Column bugs + CRM key acceptance + All 20 filters
-- ============================================

CREATE OR REPLACE FUNCTION public.rpc_kb_programs_search_v1_3_final(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Input extraction
  v_request_id text;
  v_display_lang text;
  v_display_currency_code text;
  v_program_filters jsonb;
  v_applicant_profile jsonb;
  v_admission_policy jsonb;
  v_paging jsonb;
  
  -- Validation
  v_missing_fields text[] := '{}';
  v_unknown_keys text[] := '{}';
  v_defaults_applied text[] := '{}';
  v_applied_filters jsonb := '{}'::jsonb;
  
  -- CRM-Compatible Allowlist (20 keys + aliases)
  v_allowed_program_filter_keys text[] := ARRAY[
    -- CRM singular keys (canonical for bot)
    'country_code', 'city', 'degree_slug', 'discipline_slug', 
    'study_mode', 'instruction_language', 'instruction_languages',
    'tuition_usd_min', 'tuition_usd_max', 'tuition_basis',
    'duration_months_max', 'has_dorm', 'dorm_price_monthly_usd_max',
    'monthly_living_usd_max', 'scholarship_available', 'scholarship_type',
    'partner_priority', 'do_not_offer', 'intake_months', 'deadline_before',
    -- Plural aliases (also accepted, normalized internally)
    'country_codes', 'degree_slugs', 'discipline_slugs', 'language_codes',
    'has_scholarship'
  ];
  
  -- Filter values
  v_country_code text;
  v_country_codes text[];
  v_city text;
  v_degree_slug text;
  v_degree_slugs text[];
  v_discipline_slug text;
  v_discipline_slugs text[];
  v_study_mode text;
  v_instruction_language text;
  v_instruction_languages text[];
  v_tuition_usd_min numeric;
  v_tuition_usd_max numeric;
  v_tuition_basis text;
  v_duration_months_max integer;
  v_has_dorm boolean;
  v_dorm_price_monthly_usd_max numeric;
  v_monthly_living_usd_max numeric;
  v_scholarship_available boolean;
  v_scholarship_type text;
  v_partner_priority text;
  v_do_not_offer boolean;
  v_intake_months integer[];
  v_deadline_before date;
  
  -- Paging
  v_limit integer := 24;
  v_offset integer := 0;
  
  -- Results
  v_results jsonb;
  v_total_count integer;
  v_key text;
BEGIN
  -- ============= EXTRACT INPUTS =============
  v_request_id := COALESCE(payload->>'request_id', 'unknown');
  v_display_lang := payload->>'display_lang';
  v_display_currency_code := COALESCE(payload->>'display_currency_code', 'USD');
  v_program_filters := COALESCE(payload->'program_filters', '{}'::jsonb);
  v_applicant_profile := payload->'applicant_profile';
  v_admission_policy := payload->'admission_policy';
  v_paging := COALESCE(payload->'paging', '{}'::jsonb);
  
  -- ============= VALIDATE REQUIRED FIELDS =============
  IF v_display_lang IS NULL OR v_display_lang = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'display_lang');
  END IF;
  
  -- Tuition trio is required
  IF NOT (v_program_filters ? 'tuition_basis') THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_basis');
  END IF;
  IF NOT (v_program_filters ? 'tuition_usd_min') THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_usd_min');
  END IF;
  IF NOT (v_program_filters ? 'tuition_usd_max') THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_usd_max');
  END IF;
  
  -- Partner priority: default to 'ignore' if missing (CRM compatibility)
  IF NOT (v_program_filters ? 'partner_priority') OR (v_program_filters->>'partner_priority') IS NULL THEN
    v_partner_priority := 'ignore';
    v_defaults_applied := array_append(v_defaults_applied, 'partner_priority');
  ELSE
    v_partner_priority := v_program_filters->>'partner_priority';
  END IF;
  
  -- Return early if missing required fields
  IF array_length(v_missing_fields, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', to_jsonb(v_missing_fields),
      'defaults_applied', to_jsonb(v_defaults_applied)
    );
  END IF;
  
  -- ============= CHECK FOR UNKNOWN KEYS =============
  FOR v_key IN SELECT jsonb_object_keys(v_program_filters)
  LOOP
    IF NOT (v_key = ANY(v_allowed_program_filter_keys)) THEN
      v_unknown_keys := array_append(v_unknown_keys, 'program_filters.' || v_key);
    END IF;
  END LOOP;
  
  IF array_length(v_unknown_keys, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'UNKNOWN_KEYS',
      'unknown_keys', to_jsonb(v_unknown_keys),
      'allowed_keys', to_jsonb(v_allowed_program_filter_keys)
    );
  END IF;
  
  -- ============= NORMALIZE CRM KEYS TO INTERNAL =============
  -- Country: accept singular or plural
  v_country_code := v_program_filters->>'country_code';
  IF v_program_filters ? 'country_codes' THEN
    SELECT array_agg(x) INTO v_country_codes FROM jsonb_array_elements_text(v_program_filters->'country_codes') x;
  ELSIF v_country_code IS NOT NULL THEN
    v_country_codes := ARRAY[v_country_code];
  END IF;
  
  -- Degree: accept singular or plural
  v_degree_slug := v_program_filters->>'degree_slug';
  IF v_program_filters ? 'degree_slugs' THEN
    SELECT array_agg(x) INTO v_degree_slugs FROM jsonb_array_elements_text(v_program_filters->'degree_slugs') x;
  ELSIF v_degree_slug IS NOT NULL THEN
    v_degree_slugs := ARRAY[v_degree_slug];
  END IF;
  
  -- Discipline: accept singular or plural
  v_discipline_slug := v_program_filters->>'discipline_slug';
  IF v_program_filters ? 'discipline_slugs' THEN
    SELECT array_agg(x) INTO v_discipline_slugs FROM jsonb_array_elements_text(v_program_filters->'discipline_slugs') x;
  ELSIF v_discipline_slug IS NOT NULL THEN
    v_discipline_slugs := ARRAY[v_discipline_slug];
  END IF;
  
  -- Language: accept singular, plural array, or language_codes alias
  v_instruction_language := v_program_filters->>'instruction_language';
  IF v_program_filters ? 'instruction_languages' THEN
    SELECT array_agg(x) INTO v_instruction_languages FROM jsonb_array_elements_text(v_program_filters->'instruction_languages') x;
  ELSIF v_program_filters ? 'language_codes' THEN
    SELECT array_agg(x) INTO v_instruction_languages FROM jsonb_array_elements_text(v_program_filters->'language_codes') x;
  ELSIF v_instruction_language IS NOT NULL THEN
    v_instruction_languages := ARRAY[v_instruction_language];
  END IF;
  
  -- Scholarship: accept 'scholarship_available' or 'has_scholarship'
  IF v_program_filters ? 'scholarship_available' THEN
    v_scholarship_available := (v_program_filters->>'scholarship_available')::boolean;
  ELSIF v_program_filters ? 'has_scholarship' THEN
    v_scholarship_available := (v_program_filters->>'has_scholarship')::boolean;
  END IF;
  
  -- Other filters
  v_city := v_program_filters->>'city';
  v_study_mode := v_program_filters->>'study_mode';
  v_tuition_usd_min := (v_program_filters->>'tuition_usd_min')::numeric;
  v_tuition_usd_max := (v_program_filters->>'tuition_usd_max')::numeric;
  v_tuition_basis := v_program_filters->>'tuition_basis';
  v_duration_months_max := (v_program_filters->>'duration_months_max')::integer;
  v_has_dorm := (v_program_filters->>'has_dorm')::boolean;
  v_dorm_price_monthly_usd_max := (v_program_filters->>'dorm_price_monthly_usd_max')::numeric;
  v_monthly_living_usd_max := (v_program_filters->>'monthly_living_usd_max')::numeric;
  v_scholarship_type := v_program_filters->>'scholarship_type';
  v_do_not_offer := COALESCE((v_program_filters->>'do_not_offer')::boolean, false);
  v_deadline_before := (v_program_filters->>'deadline_before')::date;
  
  -- Intake months array
  IF v_program_filters ? 'intake_months' THEN
    SELECT array_agg(x::integer) INTO v_intake_months FROM jsonb_array_elements_text(v_program_filters->'intake_months') x;
  END IF;
  
  -- Paging
  v_limit := COALESCE((v_paging->>'limit')::integer, 24);
  v_offset := COALESCE((v_paging->>'offset')::integer, 0);
  
  -- ============= BUILD APPLIED FILTERS =============
  v_applied_filters := jsonb_build_object(
    'country_codes', COALESCE(to_jsonb(v_country_codes), 'null'::jsonb),
    'degree_slugs', COALESCE(to_jsonb(v_degree_slugs), 'null'::jsonb),
    'discipline_slugs', COALESCE(to_jsonb(v_discipline_slugs), 'null'::jsonb),
    'instruction_languages', COALESCE(to_jsonb(v_instruction_languages), 'null'::jsonb),
    'tuition_basis', v_tuition_basis,
    'tuition_usd_min', v_tuition_usd_min,
    'tuition_usd_max', v_tuition_usd_max,
    'partner_priority', v_partner_priority,
    'has_dorm', v_has_dorm,
    'scholarship_available', v_scholarship_available,
    'do_not_offer', v_do_not_offer
  );
  
  -- ============= EXECUTE QUERY =============
  -- FIXED: Using correct column names from vw_program_search_api_v3_final
  WITH filtered AS (
    SELECT 
      v.program_id,
      v.university_id,
      v.country_code,
      v.city,
      v.degree_slug,
      v.discipline_slug,
      v.study_mode,
      v.instruction_languages,
      v.program_name_ar,
      v.program_name_en,
      v.university_name_ar,
      v.university_name_en,
      v.university_logo,
      v.country_name_ar,
      v.country_name_en,
      v.degree_name,
      v.discipline_name_ar,
      v.discipline_name_en,
      v.tuition_basis,
      -- FIXED: Using _min/_max columns
      v.tuition_usd_year_min,
      v.tuition_usd_year_max,
      v.tuition_usd_semester_min,
      v.tuition_usd_semester_max,
      v.tuition_usd_program_total_min,
      v.tuition_usd_program_total_max,
      v.tuition_is_free,
      v.currency_code,
      v.duration_months,
      v.has_dorm,
      v.dorm_price_monthly_usd,
      v.monthly_living_usd,
      -- FIXED: Using scholarship_available (not has_scholarship)
      v.scholarship_available,
      v.scholarship_type,
      v.partner_star,
      v.partner_tier,
      v.partner_preferred,
      v.priority_score,
      v.do_not_offer,
      v.intake_months,
      v.deadline_date,
      v.portal_url,
      v.ranking
    FROM vw_program_search_api_v3_final v
    WHERE 
      -- Always exclude do_not_offer (unless explicitly requested)
      (v_do_not_offer IS TRUE OR v.do_not_offer = false)
      -- Only published & active
      AND v.publish_status = 'published'
      AND v.is_active = true
      -- Country filter
      AND (v_country_codes IS NULL OR v.country_code = ANY(v_country_codes))
      -- City filter
      AND (v_city IS NULL OR v.city ILIKE '%' || v_city || '%')
      -- Degree filter
      AND (v_degree_slugs IS NULL OR v.degree_slug = ANY(v_degree_slugs))
      -- Discipline filter
      AND (v_discipline_slugs IS NULL OR v.discipline_slug = ANY(v_discipline_slugs))
      -- Study mode filter
      AND (v_study_mode IS NULL OR v.study_mode = v_study_mode)
      -- FIXED: Language filter using array overlap
      AND (v_instruction_languages IS NULL OR v.instruction_languages && v_instruction_languages)
      -- FIXED: Tuition filter using _min columns based on basis
      AND (
        v_tuition_usd_max IS NULL 
        OR v.tuition_is_free = true
        OR (
          CASE v_tuition_basis
            WHEN 'year' THEN COALESCE(v.tuition_usd_year_min, 0)
            WHEN 'semester' THEN COALESCE(v.tuition_usd_semester_min, 0)
            WHEN 'program_total' THEN COALESCE(v.tuition_usd_program_total_min, 0)
            ELSE COALESCE(v.tuition_usd_year_min, 0)
          END BETWEEN v_tuition_usd_min AND v_tuition_usd_max
        )
      )
      -- Duration filter
      AND (v_duration_months_max IS NULL OR v.duration_months <= v_duration_months_max)
      -- Has dorm filter
      AND (v_has_dorm IS NULL OR v.has_dorm = v_has_dorm)
      -- Dorm price filter
      AND (v_dorm_price_monthly_usd_max IS NULL OR COALESCE(v.dorm_price_monthly_usd, 0) <= v_dorm_price_monthly_usd_max)
      -- Living cost filter
      AND (v_monthly_living_usd_max IS NULL OR COALESCE(v.monthly_living_usd, 0) <= v_monthly_living_usd_max)
      -- FIXED: Scholarship filter using correct column name
      AND (v_scholarship_available IS NULL OR v.scholarship_available = v_scholarship_available)
      -- Scholarship type filter
      AND (v_scholarship_type IS NULL OR v.scholarship_type = v_scholarship_type)
      -- Intake months filter (array overlap)
      AND (v_intake_months IS NULL OR v.intake_months && v_intake_months)
      -- Deadline filter
      AND (v_deadline_before IS NULL OR v.deadline_date <= v_deadline_before)
      -- Partner priority filter
      AND (
        v_partner_priority = 'ignore'
        OR (v_partner_priority = 'star' AND v.partner_star = true)
        OR (v_partner_priority = 'preferred' AND v.partner_preferred = true)
        OR (v_partner_priority = 'any_partner' AND v.partner_tier IS NOT NULL)
      )
    ORDER BY 
      CASE WHEN v.partner_star THEN 0 ELSE 1 END,
      COALESCE(v.priority_score, 0) DESC,
      COALESCE(v.ranking, 9999) ASC,
      v.program_id
  ),
  counted AS (
    SELECT COUNT(*) as total FROM filtered
  )
  SELECT 
    jsonb_build_object(
      'items', COALESCE(jsonb_agg(to_jsonb(f.*)), '[]'::jsonb),
      'total', (SELECT total FROM counted)
    )
  INTO v_results
  FROM (SELECT * FROM filtered LIMIT v_limit OFFSET v_offset) f;
  
  v_total_count := (v_results->>'total')::integer;
  
  -- ============= RETURN SUCCESS =============
  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'items', COALESCE(v_results->'items', '[]'::jsonb),
    'applied_filters', v_applied_filters,
    'defaults_applied', to_jsonb(v_defaults_applied),
    'unknown_keys', '[]'::jsonb,
    'blocked_filters', '[]'::jsonb,
    'conflicts', '[]'::jsonb,
    'meta', jsonb_build_object(
      'count', jsonb_array_length(COALESCE(v_results->'items', '[]'::jsonb)),
      'total', v_total_count,
      'limit', v_limit,
      'offset', v_offset,
      'display_lang', v_display_lang,
      'display_currency_code', v_display_currency_code,
      'sot_view', 'vw_program_search_api_v3_final',
      'contract', 'kb_search_v1_3_crm_compat'
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'request_id', v_request_id,
    'error', 'RPC_INTERNAL_ERROR',
    'message', SQLERRM,
    'defaults_applied', to_jsonb(v_defaults_applied)
  );
END;
$$;

-- Grant execute to service_role only
REVOKE ALL ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) TO service_role;