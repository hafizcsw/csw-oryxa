CREATE OR REPLACE FUNCTION public.rpc_kb_programs_search_v1_3_final(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  -- Version
  v_version text := 'kb_search_v1_3_final';

  -- Input sections
  v_request_id text;
  v_display_lang text;
  v_display_currency_code text;
  v_filters jsonb;
  v_admission_policy jsonb;
  v_applicant_profile jsonb;
  v_paging jsonb;

  -- Parsed filters
  v_country_code text;
  v_city text;
  v_degree_slug text;
  v_discipline_slug text;
  v_study_mode text;
  v_instruction_languages text[];
  v_tuition_basis text;
  v_tuition_usd_min numeric;
  v_tuition_usd_max numeric;
  v_duration_months_max int;
  v_has_dorm boolean;
  v_dorm_price_max numeric;
  v_monthly_living_max numeric;
  v_scholarship_available boolean;
  v_scholarship_type text;
  v_partner_priority text;
  v_intake_months text[];
  v_deadline_before date;
  v_query text;

  -- Admission policy
  v_enforce_eligibility boolean;

  -- Applicant profile
  v_curriculum text;
  v_stream text;

  -- Paging
  v_limit int;
  v_offset int;

  -- FX
  v_fx_rate numeric;
  v_fx_as_of date;
  v_fx_source text;

  -- i18n
  v_lang_primary text;

  -- Validation
  v_known_program_filters text[] := ARRAY[
    'country_code', 'city', 'degree_slug', 'discipline_slug', 'study_mode',
    'instruction_languages', 'tuition_basis', 'tuition_usd_min', 'tuition_usd_max',
    'duration_months_max', 'has_dorm', 'dorm_price_monthly_usd_max', 'monthly_living_usd_max',
    'scholarship_available', 'scholarship_type', 'partner_priority',
    'intake_months', 'deadline_before', 'query'
  ];
  v_known_admission_policy text[] := ARRAY['enforce_eligibility', 'allow_unknown_as_pass', 'eligibility_filter_mode'];

  v_unknown_keys text[];
  v_missing_fields text[] := '{}';

  -- Results
  v_total int;
  v_items jsonb;
  v_applied_filters jsonb := '{}';
  v_start_time timestamptz := clock_timestamp();
  v_duration_ms int;
  v_count int;
  v_has_next boolean;
  v_next_offset int;

  -- Exception capture
  v_err_msg text;
  v_err_detail text;

BEGIN
  -- ============================================================
  -- STEP 1: Extract top-level sections (NO DEFAULTS, FAIL-CLOSED)
  -- ============================================================
  v_request_id := NULLIF(payload->>'request_id', '');
  v_display_lang := NULLIF(payload->>'display_lang', '');
  v_display_currency_code := NULLIF(payload->>'display_currency_code', '');

  IF v_request_id IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'request_id');
  END IF;
  IF v_display_lang IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'display_lang');
  END IF;
  IF v_display_currency_code IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'display_currency_code');
  END IF;

  -- Required sections must exist and be objects
  IF payload ? 'program_filters' AND jsonb_typeof(payload->'program_filters') = 'object' THEN
    v_filters := payload->'program_filters';
  ELSE
    v_filters := '{}'::jsonb;
    v_missing_fields := array_append(v_missing_fields, 'program_filters');
  END IF;

  IF payload ? 'admission_policy' AND jsonb_typeof(payload->'admission_policy') = 'object' THEN
    v_admission_policy := payload->'admission_policy';
  ELSE
    v_admission_policy := '{}'::jsonb;
    v_missing_fields := array_append(v_missing_fields, 'admission_policy');
  END IF;

  IF payload ? 'applicant_profile' AND jsonb_typeof(payload->'applicant_profile') = 'object' THEN
    v_applicant_profile := payload->'applicant_profile';
  ELSE
    v_applicant_profile := '{}'::jsonb;
    v_missing_fields := array_append(v_missing_fields, 'applicant_profile');
  END IF;

  IF payload ? 'paging' AND jsonb_typeof(payload->'paging') = 'object' THEN
    v_paging := payload->'paging';
  ELSE
    v_paging := '{}'::jsonb;
  END IF;

  IF array_length(v_missing_fields, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', to_jsonb(v_missing_fields),
      'ignored_filters', '[]'::jsonb
    );
  END IF;

  -- ============================================================
  -- STEP 2: Reject unknown keys (program_filters / admission_policy)
  -- ============================================================
  SELECT array_agg(k) INTO v_unknown_keys
  FROM jsonb_object_keys(v_filters) AS t(k)
  WHERE NOT (k = ANY(v_known_program_filters));

  IF v_unknown_keys IS NOT NULL AND array_length(v_unknown_keys, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', to_jsonb(ARRAY(SELECT 'unsupported_filter.' || unnest(v_unknown_keys))),
      'ignored_filters', '[]'::jsonb
    );
  END IF;

  SELECT array_agg(k) INTO v_unknown_keys
  FROM jsonb_object_keys(v_admission_policy) AS t(k)
  WHERE NOT (k = ANY(v_known_admission_policy));

  IF v_unknown_keys IS NOT NULL AND array_length(v_unknown_keys, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', to_jsonb(ARRAY(SELECT 'unsupported_admission_policy.' || unnest(v_unknown_keys))),
      'ignored_filters', '[]'::jsonb
    );
  END IF;

  -- ============================================================
  -- STEP 3: Mandatory fields validation (ALL failures => MISSING_DATA_FIELDS)
  -- ============================================================
  v_tuition_basis := NULLIF(v_filters->>'tuition_basis', '');
  IF v_tuition_basis IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_basis');
  ELSIF v_tuition_basis NOT IN ('year', 'semester', 'program_total') THEN
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.tuition_basis');
  END IF;

  v_partner_priority := NULLIF(v_filters->>'partner_priority', '');
  IF v_partner_priority IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.partner_priority');
  ELSIF v_partner_priority NOT IN ('prefer', 'only', 'ignore') THEN
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.partner_priority');
  END IF;

  -- Enforce eligibility must be present and true
  BEGIN
    v_enforce_eligibility := NULLIF(v_admission_policy->>'enforce_eligibility','')::boolean;
  EXCEPTION WHEN invalid_text_representation THEN
    v_enforce_eligibility := NULL;
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.admission_policy.enforce_eligibility');
  END;

  IF v_enforce_eligibility IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'admission_policy.enforce_eligibility');
  ELSIF v_enforce_eligibility = false THEN
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.enforce_eligibility_must_be_true');
  END IF;

  -- Tuition min/max mandatory
  BEGIN
    v_tuition_usd_min := NULLIF(v_filters->>'tuition_usd_min','')::numeric;
  EXCEPTION WHEN invalid_text_representation THEN
    v_tuition_usd_min := NULL;
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.tuition_usd_min');
  END;

  BEGIN
    v_tuition_usd_max := NULLIF(v_filters->>'tuition_usd_max','')::numeric;
  EXCEPTION WHEN invalid_text_representation THEN
    v_tuition_usd_max := NULL;
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.tuition_usd_max');
  END;

  IF v_tuition_usd_min IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_usd_min');
  END IF;
  IF v_tuition_usd_max IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_usd_max');
  END IF;

  IF v_tuition_usd_min IS NOT NULL AND v_tuition_usd_max IS NOT NULL AND v_tuition_usd_min > v_tuition_usd_max THEN
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.tuition_usd_range');
  END IF;

  v_curriculum := NULLIF(v_applicant_profile->>'curriculum', '');
  IF v_curriculum IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'applicant_profile.curriculum');
  END IF;

  v_stream := NULLIF(v_applicant_profile->>'stream', '');
  IF v_stream IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'applicant_profile.stream');
  END IF;

  IF array_length(v_missing_fields, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', to_jsonb(v_missing_fields),
      'ignored_filters', '[]'::jsonb
    );
  END IF;

  -- ============================================================
  -- STEP 4: Column/table gating (fail-closed => 422)
  -- ============================================================
  BEGIN
    -- view columns used in WHERE/SELECT
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'is_active');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'publish_status');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'do_not_offer');

    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'partner_preferred');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'partner_tier');

    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'tuition_is_free');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'tuition_usd_year_min');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'tuition_usd_year_max');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'tuition_usd_semester_min');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'tuition_usd_semester_max');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'tuition_usd_program_total_min');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'tuition_usd_program_total_max');

    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'country_code');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'city');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'degree_slug');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'discipline_slug');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'study_mode');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'instruction_languages');

    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'duration_months');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'has_dorm');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'dorm_price_monthly_usd');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'monthly_living_usd');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'scholarship_available');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'scholarship_type');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'intake_months');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'deadline_date');

    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'program_name_ar');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'program_name_en');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'university_name_ar');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'university_name_en');

    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'display_name_i18n');
    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'university_display_name_i18n');

    PERFORM public.kb_require_column('vw_program_search_api_v3_final', 'portal_url');

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT, v_err_detail = PG_EXCEPTION_DETAIL;
    IF v_err_msg = 'MISSING_DATA_FIELDS' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', COALESCE(v_err_detail::jsonb, '[]'::jsonb),
        'ignored_filters', '[]'::jsonb
      );
    END IF;
    RAISE;
  END;

  -- ============================================================
  -- STEP 5: FX lookup (fail-closed if missing)
  -- ============================================================
  IF v_display_currency_code <> 'USD' THEN
    BEGIN
      PERFORM public.kb_require_table('public.fx_rates_latest');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT, v_err_detail = PG_EXCEPTION_DETAIL;
      IF v_err_msg = 'MISSING_DATA_FIELDS' THEN
        RETURN jsonb_build_object(
          'ok', false,
          'request_id', v_request_id,
          'error', 'MISSING_DATA_FIELDS',
          'missing_data_fields', COALESCE(v_err_detail::jsonb, '[]'::jsonb),
          'ignored_filters', '[]'::jsonb
        );
      END IF;
      RAISE;
    END;

    SELECT rate_to_usd, as_of_date, source
    INTO v_fx_rate, v_fx_as_of, v_fx_source
    FROM public.fx_rates_latest
    WHERE currency_code = v_display_currency_code;

    IF v_fx_rate IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', to_jsonb(ARRAY['fx_rates_latest.' || v_display_currency_code]),
        'ignored_filters', '[]'::jsonb
      );
    END IF;
  ELSE
    v_fx_rate := 1.0;
    v_fx_as_of := CURRENT_DATE;
    v_fx_source := 'identity';
  END IF;

  -- ============================================================
  -- STEP 6: Parse optional filters (safe casts)
  -- ============================================================
  v_country_code := NULLIF(v_filters->>'country_code', '');
  v_city := NULLIF(v_filters->>'city', '');
  v_degree_slug := NULLIF(v_filters->>'degree_slug', '');
  v_discipline_slug := NULLIF(v_filters->>'discipline_slug', '');
  v_study_mode := NULLIF(v_filters->>'study_mode', '');
  v_query := NULLIF(v_filters->>'query', '');

  IF v_filters ? 'instruction_languages' AND jsonb_typeof(v_filters->'instruction_languages') = 'array' THEN
    SELECT array_agg(elem::text) INTO v_instruction_languages
    FROM jsonb_array_elements_text(v_filters->'instruction_languages') AS elem;
  END IF;

  IF v_filters ? 'duration_months_max' THEN
    BEGIN
      v_duration_months_max := NULLIF(v_filters->>'duration_months_max','')::int;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', to_jsonb(ARRAY['invalid_value.duration_months_max']),
        'ignored_filters', '[]'::jsonb
      );
    END;
  END IF;

  IF v_filters ? 'has_dorm' THEN
    BEGIN
      v_has_dorm := NULLIF(v_filters->>'has_dorm','')::boolean;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', to_jsonb(ARRAY['invalid_value.has_dorm']),
        'ignored_filters', '[]'::jsonb
      );
    END;
  END IF;

  IF v_filters ? 'dorm_price_monthly_usd_max' THEN
    BEGIN
      v_dorm_price_max := NULLIF(v_filters->>'dorm_price_monthly_usd_max','')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', to_jsonb(ARRAY['invalid_value.dorm_price_monthly_usd_max']),
        'ignored_filters', '[]'::jsonb
      );
    END;
  END IF;

  IF v_filters ? 'monthly_living_usd_max' THEN
    BEGIN
      v_monthly_living_max := NULLIF(v_filters->>'monthly_living_usd_max','')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', to_jsonb(ARRAY['invalid_value.monthly_living_usd_max']),
        'ignored_filters', '[]'::jsonb
      );
    END;
  END IF;

  IF v_filters ? 'scholarship_available' THEN
    BEGIN
      v_scholarship_available := NULLIF(v_filters->>'scholarship_available','')::boolean;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', to_jsonb(ARRAY['invalid_value.scholarship_available']),
        'ignored_filters', '[]'::jsonb
      );
    END;
  END IF;

  v_scholarship_type := NULLIF(v_filters->>'scholarship_type', '');

  IF v_filters ? 'intake_months' AND jsonb_typeof(v_filters->'intake_months') = 'array' THEN
    SELECT array_agg(elem::text) INTO v_intake_months
    FROM jsonb_array_elements_text(v_filters->'intake_months') AS elem;
  END IF;

  IF v_filters ? 'deadline_before' THEN
    BEGIN
      v_deadline_before := NULLIF(v_filters->>'deadline_before','')::date;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', to_jsonb(ARRAY['invalid_value.deadline_before']),
        'ignored_filters', '[]'::jsonb
      );
    END;
  END IF;

  -- Paging with CAP = 50
  v_limit := LEAST(COALESCE(NULLIF(v_paging->>'limit','')::int, 24), 50);
  v_offset := COALESCE(NULLIF(v_paging->>'offset','')::int, 0);

  -- I18N fallback primary
  v_lang_primary := split_part(v_display_lang, '-', 1);

  -- ============================================================
  -- STEP 7: COUNT TOTAL
  -- ============================================================
  EXECUTE format($q$
    SELECT COUNT(*)
    FROM public.vw_program_search_api_v3_final v
    WHERE v.is_active = true
      AND v.publish_status = 'published'
      AND COALESCE(v.do_not_offer, false) = false
      -- Partner filter (only = partner_preferred = true)
      AND (
        CASE 
          WHEN %L = 'only' THEN COALESCE(v.partner_preferred,false) = true
          WHEN %L = 'ignore' THEN true
          ELSE true
        END
      )
      -- Tuition filter (FREE = 0)
      AND (
        CASE %L
          WHEN 'year' THEN 
            (v.tuition_is_free = true AND 0 >= %L::numeric AND 0 <= %L::numeric)
            OR (COALESCE(v.tuition_usd_year_min, 0) >= %L::numeric AND COALESCE(v.tuition_usd_year_max, v.tuition_usd_year_min, 0) <= %L::numeric)
          WHEN 'semester' THEN
            (v.tuition_is_free = true AND 0 >= %L::numeric AND 0 <= %L::numeric)
            OR (COALESCE(v.tuition_usd_semester_min, 0) >= %L::numeric AND COALESCE(v.tuition_usd_semester_max, v.tuition_usd_semester_min, 0) <= %L::numeric)
          WHEN 'program_total' THEN
            (v.tuition_is_free = true AND 0 >= %L::numeric AND 0 <= %L::numeric)
            OR (COALESCE(v.tuition_usd_program_total_min, 0) >= %L::numeric AND COALESCE(v.tuition_usd_program_total_max, v.tuition_usd_program_total_min, 0) <= %L::numeric)
          ELSE false
        END
      )
      AND (%L IS NULL OR v.country_code = %L)
      AND (%L IS NULL OR v.city ILIKE '%%' || %L || '%%')
      AND (%L IS NULL OR v.degree_slug = %L)
      AND (%L IS NULL OR v.discipline_slug = %L)
      AND (%L IS NULL OR v.study_mode = %L)
      AND (%L::text[] IS NULL OR v.instruction_languages && %L::text[])
      AND (%L::int IS NULL OR v.duration_months <= %L)
      AND (%L::boolean IS NULL OR v.has_dorm = %L)
      AND (%L::numeric IS NULL OR COALESCE(v.dorm_price_monthly_usd, 0) <= %L)
      AND (%L::numeric IS NULL OR COALESCE(v.monthly_living_usd, 0) <= %L)
      AND (%L::boolean IS NULL OR v.scholarship_available = %L)
      AND (%L IS NULL OR v.scholarship_type = %L)
      AND (%L::text[] IS NULL OR v.intake_months && %L::text[])
      AND (%L::date IS NULL OR v.deadline_date <= %L)
      AND (%L IS NULL OR (
        v.program_name_ar ILIKE '%%' || %L || '%%'
        OR v.program_name_en ILIKE '%%' || %L || '%%'
        OR v.university_name_ar ILIKE '%%' || %L || '%%'
        OR v.university_name_en ILIKE '%%' || %L || '%%'
      ))
  $q$,
    v_partner_priority, v_partner_priority,
    v_tuition_basis,
    v_tuition_usd_min, v_tuition_usd_max, v_tuition_usd_min, v_tuition_usd_max,
    v_tuition_usd_min, v_tuition_usd_max, v_tuition_usd_min, v_tuition_usd_max,
    v_tuition_usd_min, v_tuition_usd_max, v_tuition_usd_min, v_tuition_usd_max,
    v_country_code, v_country_code,
    v_city, v_city,
    v_degree_slug, v_degree_slug,
    v_discipline_slug, v_discipline_slug,
    v_study_mode, v_study_mode,
    v_instruction_languages, v_instruction_languages,
    v_duration_months_max, v_duration_months_max,
    v_has_dorm, v_has_dorm,
    v_dorm_price_max, v_dorm_price_max,
    v_monthly_living_max, v_monthly_living_max,
    v_scholarship_available, v_scholarship_available,
    v_scholarship_type, v_scholarship_type,
    v_intake_months, v_intake_months,
    v_deadline_before, v_deadline_before,
    v_query, v_query, v_query, v_query, v_query
  ) INTO v_total;

  -- ============================================================
  -- STEP 8: FETCH ITEMS (FLAT RESPONSE)
  -- ============================================================
  EXECUTE format($q$
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    FROM (
      SELECT 
        v.program_id,
        v.university_id,
        v.country_code,
        v.city,
        v.degree_slug,
        v.discipline_slug,
        v.study_mode,
        v.duration_months,
        v.instruction_languages,
        v.intake_months,
        v.deadline_date,
        -- I18N names with fallback
        COALESCE(
          v.display_name_i18n->>%L,
          v.display_name_i18n->>%L,
          v.display_name_i18n->>'en',
          v.display_name_i18n->>'ar',
          v.program_name_ar
        ) AS program_name,
        COALESCE(
          v.university_display_name_i18n->>%L,
          v.university_display_name_i18n->>%L,
          v.university_display_name_i18n->>'en',
          v.university_display_name_i18n->>'ar',
          v.university_name_ar
        ) AS university_name,
        -- FLAT tuition (FREE = 0)
        %L AS tuition_basis,
        CASE WHEN v.tuition_is_free THEN 0 ELSE
          CASE %L
            WHEN 'year' THEN COALESCE(v.tuition_usd_year_min, 0)
            WHEN 'semester' THEN COALESCE(v.tuition_usd_semester_min, 0)
            WHEN 'program_total' THEN COALESCE(v.tuition_usd_program_total_min, 0)
            ELSE 0
          END
        END AS tuition_usd_min,
        CASE WHEN v.tuition_is_free THEN 0 ELSE
          CASE %L
            WHEN 'year' THEN COALESCE(v.tuition_usd_year_max, v.tuition_usd_year_min, 0)
            WHEN 'semester' THEN COALESCE(v.tuition_usd_semester_max, v.tuition_usd_semester_min, 0)
            WHEN 'program_total' THEN COALESCE(v.tuition_usd_program_total_max, v.tuition_usd_program_total_min, 0)
            ELSE 0
          END
        END AS tuition_usd_max,
        CASE WHEN v.tuition_is_free THEN 0 ELSE
          ROUND((CASE %L
            WHEN 'year' THEN COALESCE(v.tuition_usd_year_min, 0)
            WHEN 'semester' THEN COALESCE(v.tuition_usd_semester_min, 0)
            WHEN 'program_total' THEN COALESCE(v.tuition_usd_program_total_min, 0)
            ELSE 0
          END) / %L::numeric, 2)
        END AS tuition_display_min,
        CASE WHEN v.tuition_is_free THEN 0 ELSE
          ROUND((CASE %L
            WHEN 'year' THEN COALESCE(v.tuition_usd_year_max, v.tuition_usd_year_min, 0)
            WHEN 'semester' THEN COALESCE(v.tuition_usd_semester_max, v.tuition_usd_semester_min, 0)
            WHEN 'program_total' THEN COALESCE(v.tuition_usd_program_total_max, v.tuition_usd_program_total_min, 0)
            ELSE 0
          END) / %L::numeric, 2)
        END AS tuition_display_max,
        v.tuition_is_free,
        %L AS display_currency_code,
        v.has_dorm,
        COALESCE(v.dorm_price_monthly_usd, 0) AS dorm_price_monthly_usd,
        COALESCE(v.monthly_living_usd, 0) AS monthly_living_usd,
        v.scholarship_available,
        v.scholarship_type,
        v.partner_tier,
        v.partner_preferred,
        v.portal_url,
        %L AS lang_requested,
        CASE 
          WHEN v.display_name_i18n ? %L THEN %L
          WHEN v.display_name_i18n ? %L THEN %L
          WHEN v.display_name_i18n ? 'en' THEN 'en'
          ELSE 'ar'
        END AS lang_served,
        CASE 
          WHEN v.display_name_i18n ? %L THEN 'exact'
          WHEN v.display_name_i18n ? %L THEN 'primary'
          WHEN v.display_name_i18n ? 'en' THEN 'fallback_en'
          ELSE 'fallback_ar'
        END AS i18n_status,
        jsonb_build_object('status', 'eligible', 'reasons', '[]'::jsonb) AS eligibility
      FROM public.vw_program_search_api_v3_final v
      WHERE v.is_active = true
        AND v.publish_status = 'published'
        AND COALESCE(v.do_not_offer, false) = false
        AND (
          CASE 
            WHEN %L = 'only' THEN COALESCE(v.partner_preferred,false) = true
            WHEN %L = 'ignore' THEN true
            ELSE true
          END
        )
        AND (
          CASE %L
            WHEN 'year' THEN 
              (v.tuition_is_free = true AND 0 >= %L::numeric AND 0 <= %L::numeric)
              OR (COALESCE(v.tuition_usd_year_min, 0) >= %L::numeric AND COALESCE(v.tuition_usd_year_max, v.tuition_usd_year_min, 0) <= %L::numeric)
            WHEN 'semester' THEN
              (v.tuition_is_free = true AND 0 >= %L::numeric AND 0 <= %L::numeric)
              OR (COALESCE(v.tuition_usd_semester_min, 0) >= %L::numeric AND COALESCE(v.tuition_usd_semester_max, v.tuition_usd_semester_min, 0) <= %L::numeric)
            WHEN 'program_total' THEN
              (v.tuition_is_free = true AND 0 >= %L::numeric AND 0 <= %L::numeric)
              OR (COALESCE(v.tuition_usd_program_total_min, 0) >= %L::numeric AND COALESCE(v.tuition_usd_program_total_max, v.tuition_usd_program_total_min, 0) <= %L::numeric)
            ELSE false
          END
        )
        AND (%L IS NULL OR v.country_code = %L)
        AND (%L IS NULL OR v.city ILIKE '%%' || %L || '%%')
        AND (%L IS NULL OR v.degree_slug = %L)
        AND (%L IS NULL OR v.discipline_slug = %L)
        AND (%L IS NULL OR v.study_mode = %L)
        AND (%L::text[] IS NULL OR v.instruction_languages && %L::text[])
        AND (%L::int IS NULL OR v.duration_months <= %L)
        AND (%L::boolean IS NULL OR v.has_dorm = %L)
        AND (%L::numeric IS NULL OR COALESCE(v.dorm_price_monthly_usd, 0) <= %L)
        AND (%L::numeric IS NULL OR COALESCE(v.monthly_living_usd, 0) <= %L)
        AND (%L::boolean IS NULL OR v.scholarship_available = %L)
        AND (%L IS NULL OR v.scholarship_type = %L)
        AND (%L::text[] IS NULL OR v.intake_months && %L::text[])
        AND (%L::date IS NULL OR v.deadline_date <= %L)
        AND (%L IS NULL OR (
          v.program_name_ar ILIKE '%%' || %L || '%%'
          OR v.program_name_en ILIKE '%%' || %L || '%%'
          OR v.university_name_ar ILIKE '%%' || %L || '%%'
          OR v.university_name_en ILIKE '%%' || %L || '%%'
        ))
      ORDER BY
        CASE WHEN %L = 'prefer' THEN (CASE WHEN COALESCE(v.partner_preferred,false)=true THEN 0 ELSE 1 END) ELSE 0 END,
        v.program_name_ar
      LIMIT %L OFFSET %L
    ) t
  $q$,
    v_display_lang, v_lang_primary, v_display_lang, v_lang_primary,
    v_tuition_basis, v_tuition_basis, v_tuition_basis,
    v_tuition_basis, v_fx_rate, v_tuition_basis, v_fx_rate,
    v_display_currency_code,
    v_display_lang, v_display_lang, v_display_lang, v_lang_primary, v_lang_primary,
    v_display_lang, v_lang_primary,
    v_partner_priority, v_partner_priority,
    v_tuition_basis,
    v_tuition_usd_min, v_tuition_usd_max, v_tuition_usd_min, v_tuition_usd_max,
    v_tuition_usd_min, v_tuition_usd_max, v_tuition_usd_min, v_tuition_usd_max,
    v_tuition_usd_min, v_tuition_usd_max, v_tuition_usd_min, v_tuition_usd_max,
    v_country_code, v_country_code,
    v_city, v_city,
    v_degree_slug, v_degree_slug,
    v_discipline_slug, v_discipline_slug,
    v_study_mode, v_study_mode,
    v_instruction_languages, v_instruction_languages,
    v_duration_months_max, v_duration_months_max,
    v_has_dorm, v_has_dorm,
    v_dorm_price_max, v_dorm_price_max,
    v_monthly_living_max, v_monthly_living_max,
    v_scholarship_available, v_scholarship_available,
    v_scholarship_type, v_scholarship_type,
    v_intake_months, v_intake_months,
    v_deadline_before, v_deadline_before,
    v_query, v_query, v_query, v_query, v_query,
    v_partner_priority, v_limit, v_offset
  ) INTO v_items;

  -- ============================================================
  -- STEP 9: Build applied_filters
  -- ============================================================
  v_applied_filters := jsonb_build_object(
    'tuition_basis', v_tuition_basis,
    'partner_priority', v_partner_priority,
    'enforce_eligibility', v_enforce_eligibility
  );

  IF v_country_code IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('country_code', v_country_code); END IF;
  IF v_city IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('city', v_city); END IF;
  IF v_degree_slug IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('degree_slug', v_degree_slug); END IF;
  IF v_discipline_slug IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('discipline_slug', v_discipline_slug); END IF;
  IF v_study_mode IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('study_mode', v_study_mode); END IF;
  IF v_instruction_languages IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('instruction_languages', to_jsonb(v_instruction_languages)); END IF;
  IF v_tuition_usd_min IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('tuition_usd_min', v_tuition_usd_min); END IF;
  IF v_tuition_usd_max IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('tuition_usd_max', v_tuition_usd_max); END IF;
  IF v_duration_months_max IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('duration_months_max', v_duration_months_max); END IF;
  IF v_has_dorm IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('has_dorm', v_has_dorm); END IF;
  IF v_dorm_price_max IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('dorm_price_monthly_usd_max', v_dorm_price_max); END IF;
  IF v_monthly_living_max IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('monthly_living_usd_max', v_monthly_living_max); END IF;
  IF v_scholarship_available IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('scholarship_available', v_scholarship_available); END IF;
  IF v_scholarship_type IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('scholarship_type', v_scholarship_type); END IF;
  IF v_intake_months IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('intake_months', to_jsonb(v_intake_months)); END IF;
  IF v_deadline_before IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('deadline_before', v_deadline_before); END IF;
  IF v_query IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('query', v_query); END IF;

  v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::int;
  v_count := jsonb_array_length(v_items);
  v_has_next := (v_offset + v_count) < v_total;
  v_next_offset := CASE WHEN v_has_next THEN v_offset + v_count ELSE NULL END;

  -- ============================================================
  -- STEP 10: Return response (pagination fixed)
  -- ============================================================
  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'meta', jsonb_build_object(
      'count', v_count,
      'total', v_total,
      'display_lang', v_display_lang,
      'display_currency_code', v_display_currency_code,
      'duration_ms', v_duration_ms
    ),
    'items', v_items,
    'applied_filters', v_applied_filters,
    'ignored_filters', '[]'::jsonb,
    'missing_data_fields', '[]'::jsonb,
    'fx', jsonb_build_object(
      'usd_to_display_rate', ROUND(1.0 / v_fx_rate, 6),
      'display_to_usd_rate', v_fx_rate,
      'as_of', v_fx_as_of,
      'source', v_fx_source
    ),
    'capabilities', jsonb_build_object(
      'eligibility_engine', 'hard_filter_v1',
      'fx_conversion', true,
      'i18n_fallback', 'exact→primary→en→ar',
      'partner_priority', true,
      'query_search', true
    ),
    'has_next', v_has_next,
    'next_offset', v_next_offset
  );

EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT, v_err_detail = PG_EXCEPTION_DETAIL;

    IF v_err_msg = 'MISSING_DATA_FIELDS' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', COALESCE(v_err_detail::jsonb, '[]'::jsonb),
        'ignored_filters', '[]'::jsonb
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'INTERNAL_ERROR',
      'message', SQLERRM,
      'ignored_filters', '[]'::jsonb,
      'missing_data_fields', '[]'::jsonb
    );
END;
$function$;