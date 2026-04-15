-- FIX: Column names to match actual view schema
-- View has: tuition_usd_year_min NOT tuition_year_usd_min

CREATE OR REPLACE FUNCTION public.rpc_kb_programs_search_v1_3_final(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id text;
  v_display_lang text;
  v_display_currency text;
  v_filters jsonb;
  v_admission jsonb;
  v_applicant jsonb;
  v_paging jsonb;
  v_limit int;
  v_offset int;
  
  -- Mandatory filters
  v_tuition_usd_min numeric;
  v_tuition_usd_max numeric;
  v_tuition_basis text;
  v_partner_priority text;
  v_enforce_eligibility boolean;
  
  -- Optional filters
  v_country_code text;
  v_city text;
  v_degree_slug text;
  v_discipline_slug text;
  v_study_mode text;
  v_instruction_languages text[];
  v_duration_months_max int;
  v_has_dorm boolean;
  v_dorm_price_max numeric;
  v_monthly_living_max numeric;
  v_scholarship_available boolean;
  v_scholarship_type text;
  v_intake_months text[];
  v_deadline_before date;
  
  -- Applicant profile
  v_curriculum text;
  v_stream text;
  
  -- i18n
  v_lang_primary text;
  
  -- FX
  v_fx_rate numeric;
  v_fx_as_of date;
  v_fx_source text;
  
  -- Results
  v_items jsonb;
  v_count int;
  v_total int;
  v_start_ts timestamptz := clock_timestamp();
  
  -- Validation
  v_missing_fields text[] := '{}';
  v_unknown_keys text[];
  v_temp_key text;
  v_known_program_filters text[] := ARRAY[
    'country_code', 'city', 'degree_slug', 'discipline_slug', 'study_mode',
    'instruction_languages', 'tuition_usd_min', 'tuition_usd_max', 'tuition_basis',
    'duration_months_max', 'has_dorm', 'dorm_price_monthly_usd_max', 'monthly_living_usd_max',
    'scholarship_available', 'scholarship_type', 'partner_priority',
    'intake_months', 'deadline_before'
  ];
  v_known_admission_keys text[] := ARRAY[
    'enforce_eligibility', 'eligibility_filter_mode', 'allow_unknown_as_pass'
  ];
BEGIN
  -- ============================================
  -- 1. EXTRACT TOP-LEVEL REQUIRED FIELDS
  -- ============================================
  v_request_id := payload->>'request_id';
  v_display_lang := payload->>'display_lang';
  v_display_currency := payload->>'display_currency_code';
  v_filters := COALESCE(payload->'program_filters', '{}'::jsonb);
  v_admission := COALESCE(payload->'admission_policy', '{}'::jsonb);
  v_applicant := COALESCE(payload->'applicant_profile', '{}'::jsonb);
  v_paging := COALESCE(payload->'paging', '{}'::jsonb);
  
  -- Check required top-level
  IF v_request_id IS NULL THEN v_missing_fields := array_append(v_missing_fields, 'request_id'); END IF;
  IF v_display_lang IS NULL THEN v_missing_fields := array_append(v_missing_fields, 'display_lang'); END IF;
  IF v_display_currency IS NULL THEN v_missing_fields := array_append(v_missing_fields, 'display_currency_code'); END IF;
  
  -- ============================================
  -- 2. REJECT UNKNOWN FILTERS (program_filters)
  -- ============================================
  SELECT array_agg(k) INTO v_unknown_keys
  FROM jsonb_object_keys(v_filters) AS k
  WHERE k != ALL(v_known_program_filters);
  
  IF v_unknown_keys IS NOT NULL AND array_length(v_unknown_keys, 1) > 0 THEN
    FOREACH v_temp_key IN ARRAY v_unknown_keys LOOP
      v_missing_fields := array_append(v_missing_fields, 'unsupported_filter.' || v_temp_key);
    END LOOP;
  END IF;
  
  -- ============================================
  -- 3. REJECT UNKNOWN FILTERS (admission_policy)
  -- ============================================
  SELECT array_agg(k) INTO v_unknown_keys
  FROM jsonb_object_keys(v_admission) AS k
  WHERE k != ALL(v_known_admission_keys);
  
  IF v_unknown_keys IS NOT NULL AND array_length(v_unknown_keys, 1) > 0 THEN
    FOREACH v_temp_key IN ARRAY v_unknown_keys LOOP
      v_missing_fields := array_append(v_missing_fields, 'unsupported_admission.' || v_temp_key);
    END LOOP;
  END IF;
  
  -- ============================================
  -- 4. MANDATORY FILTERS (FAIL-CLOSED)
  -- ============================================
  v_tuition_usd_min := (v_filters->>'tuition_usd_min')::numeric;
  v_tuition_usd_max := (v_filters->>'tuition_usd_max')::numeric;
  v_tuition_basis := NULLIF(v_filters->>'tuition_basis', '');
  v_partner_priority := NULLIF(v_filters->>'partner_priority', '');
  
  IF v_tuition_usd_min IS NULL THEN v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_usd_min'); END IF;
  IF v_tuition_usd_max IS NULL THEN v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_usd_max'); END IF;
  IF v_tuition_basis IS NULL THEN v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_basis'); END IF;
  IF v_partner_priority IS NULL THEN v_missing_fields := array_append(v_missing_fields, 'program_filters.partner_priority'); END IF;
  
  -- Validate tuition_basis enum
  IF v_tuition_basis IS NOT NULL AND v_tuition_basis NOT IN ('year', 'semester', 'program_total') THEN
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.tuition_basis');
  END IF;
  
  -- Validate partner_priority enum
  IF v_partner_priority IS NOT NULL AND v_partner_priority NOT IN ('prefer', 'only', 'ignore') THEN
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.partner_priority');
  END IF;
  
  -- ============================================
  -- 5. MANDATORY ADMISSION POLICY (FAIL-CLOSED)
  -- ============================================
  v_enforce_eligibility := (v_admission->>'enforce_eligibility')::boolean;
  
  IF v_enforce_eligibility IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'admission_policy.enforce_eligibility');
  ELSIF v_enforce_eligibility = false THEN
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.enforce_eligibility_must_be_true');
  END IF;
  
  -- ============================================
  -- 6. APPLICANT PROFILE VALIDATION
  -- ============================================
  IF v_enforce_eligibility = true THEN
    v_curriculum := v_applicant->>'curriculum';
    v_stream := v_applicant->>'stream';
    
    IF v_curriculum IS NULL THEN v_missing_fields := array_append(v_missing_fields, 'applicant_profile.curriculum'); END IF;
    IF v_stream IS NULL THEN v_missing_fields := array_append(v_missing_fields, 'applicant_profile.stream'); END IF;
  END IF;
  
  -- ============================================
  -- 7. FAIL EARLY IF ANY MISSING
  -- ============================================
  IF array_length(v_missing_fields, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', to_jsonb(v_missing_fields),
      'ignored_filters', '[]'::jsonb
    );
  END IF;
  
  -- ============================================
  -- 8. FX RATE CHECK (if not USD)
  -- ============================================
  IF v_display_currency != 'USD' THEN
    SELECT rate_to_usd, as_of_date, source
    INTO v_fx_rate, v_fx_as_of, v_fx_source
    FROM public.fx_rates_latest
    WHERE currency_code = v_display_currency;
    
    IF v_fx_rate IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', jsonb_build_array('fx_rates_latest.' || v_display_currency),
        'ignored_filters', '[]'::jsonb
      );
    END IF;
  ELSE
    v_fx_rate := 1.0;
    v_fx_as_of := current_date;
    v_fx_source := 'identity';
  END IF;
  
  -- ============================================
  -- 9. EXTRACT OPTIONAL FILTERS
  -- ============================================
  v_country_code := NULLIF(v_filters->>'country_code', '');
  v_city := NULLIF(v_filters->>'city', '');
  v_degree_slug := NULLIF(v_filters->>'degree_slug', '');
  v_discipline_slug := NULLIF(v_filters->>'discipline_slug', '');
  v_study_mode := NULLIF(v_filters->>'study_mode', '');
  v_duration_months_max := (v_filters->>'duration_months_max')::int;
  v_has_dorm := (v_filters->>'has_dorm')::boolean;
  v_dorm_price_max := (v_filters->>'dorm_price_monthly_usd_max')::numeric;
  v_monthly_living_max := (v_filters->>'monthly_living_usd_max')::numeric;
  v_scholarship_available := (v_filters->>'scholarship_available')::boolean;
  v_scholarship_type := NULLIF(v_filters->>'scholarship_type', '');
  v_deadline_before := (v_filters->>'deadline_before')::date;
  
  -- instruction_languages: UNIFIED NAME (text[] only)
  IF v_filters ? 'instruction_languages' AND jsonb_typeof(v_filters->'instruction_languages') = 'array' THEN
    SELECT array_agg(elem::text) INTO v_instruction_languages
    FROM jsonb_array_elements_text(v_filters->'instruction_languages') elem;
  END IF;
  
  -- intake_months (text[])
  IF v_filters ? 'intake_months' AND jsonb_typeof(v_filters->'intake_months') = 'array' THEN
    SELECT array_agg(elem::text) INTO v_intake_months
    FROM jsonb_array_elements_text(v_filters->'intake_months') elem;
  END IF;
  
  -- ============================================
  -- 10. I18N FALLBACK (BCP-47)
  -- ============================================
  v_lang_primary := split_part(v_display_lang, '-', 1);
  
  -- ============================================
  -- 11. PAGING
  -- ============================================
  v_limit := COALESCE((v_paging->>'limit')::int, 24);
  v_offset := COALESCE((v_paging->>'offset')::int, 0);
  IF v_limit > 100 THEN v_limit := 100; END IF;
  IF v_limit < 1 THEN v_limit := 24; END IF;
  
  -- ============================================
  -- 12. MAIN QUERY - FLAT RESPONSE SHAPE
  -- (Using correct column names from view)
  -- ============================================
  WITH filtered AS (
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
      v.has_dorm,
      v.dorm_price_monthly_usd,
      v.monthly_living_usd,
      v.scholarship_available,
      v.scholarship_type,
      v.partner_tier,
      v.partner_preferred,
      v.tuition_is_free,
      v.portal_url,
      -- Tuition by basis (CORRECT column names)
      CASE v_tuition_basis
        WHEN 'year' THEN v.tuition_usd_year_min
        WHEN 'semester' THEN v.tuition_usd_semester_min
        WHEN 'program_total' THEN v.tuition_usd_program_total_min
        ELSE v.tuition_usd_year_min
      END AS tuition_basis_min,
      CASE v_tuition_basis
        WHEN 'year' THEN v.tuition_usd_year_max
        WHEN 'semester' THEN v.tuition_usd_semester_max
        WHEN 'program_total' THEN v.tuition_usd_program_total_max
        ELSE v.tuition_usd_year_max
      END AS tuition_basis_max,
      -- i18n names with fallback
      CASE 
        WHEN v.display_name_i18n ? v_display_lang THEN v.display_name_i18n->>v_display_lang
        WHEN v.display_name_i18n ? v_lang_primary THEN v.display_name_i18n->>v_lang_primary
        WHEN v.display_name_i18n ? 'en' THEN v.display_name_i18n->>'en'
        ELSE v.display_name_i18n->>'ar'
      END AS display_name,
      CASE 
        WHEN v.university_display_name_i18n ? v_display_lang THEN v.university_display_name_i18n->>v_display_lang
        WHEN v.university_display_name_i18n ? v_lang_primary THEN v.university_display_name_i18n->>v_lang_primary
        WHEN v.university_display_name_i18n ? 'en' THEN v.university_display_name_i18n->>'en'
        ELSE v.university_display_name_i18n->>'ar'
      END AS university_name,
      -- i18n status
      CASE 
        WHEN v.display_name_i18n ? v_display_lang THEN 'exact'
        WHEN v.display_name_i18n ? v_lang_primary THEN 'primary_fallback'
        WHEN v.display_name_i18n ? 'en' THEN 'en_fallback'
        ELSE 'ar_fallback'
      END AS i18n_status_val,
      CASE 
        WHEN v.display_name_i18n ? v_display_lang THEN v_display_lang
        WHEN v.display_name_i18n ? v_lang_primary THEN v_lang_primary
        WHEN v.display_name_i18n ? 'en' THEN 'en'
        ELSE 'ar'
      END AS lang_served_val
    FROM vw_program_search_api_v3_final v
    WHERE v.is_active = true
      AND v.publish_status = 'published'
      AND COALESCE(v.do_not_offer, false) = false
      -- Tuition filter
      AND (
        v.tuition_is_free = true
        OR (
          CASE v_tuition_basis
            WHEN 'year' THEN v.tuition_usd_year_min
            WHEN 'semester' THEN v.tuition_usd_semester_min
            WHEN 'program_total' THEN v.tuition_usd_program_total_min
            ELSE v.tuition_usd_year_min
          END >= v_tuition_usd_min
          AND
          CASE v_tuition_basis
            WHEN 'year' THEN v.tuition_usd_year_max
            WHEN 'semester' THEN v.tuition_usd_semester_max
            WHEN 'program_total' THEN v.tuition_usd_program_total_max
            ELSE v.tuition_usd_year_max
          END <= v_tuition_usd_max
        )
      )
      -- Partner priority
      AND (
        v_partner_priority = 'ignore'
        OR (v_partner_priority = 'only' AND COALESCE(v.partner_preferred, false) = true)
        OR (v_partner_priority = 'prefer')
      )
      -- Optional filters
      AND (v_country_code IS NULL OR v.country_code = v_country_code)
      AND (v_city IS NULL OR v.city ILIKE '%' || v_city || '%')
      AND (v_degree_slug IS NULL OR v.degree_slug = v_degree_slug)
      AND (v_discipline_slug IS NULL OR v.discipline_slug = v_discipline_slug)
      AND (v_study_mode IS NULL OR v.study_mode = v_study_mode)
      AND (v_instruction_languages IS NULL OR v.instruction_languages && v_instruction_languages)
      AND (v_duration_months_max IS NULL OR COALESCE(v.duration_months, 0) <= v_duration_months_max)
      AND (v_has_dorm IS NULL OR v.has_dorm = v_has_dorm)
      AND (v_dorm_price_max IS NULL OR COALESCE(v.dorm_price_monthly_usd, 0) <= v_dorm_price_max)
      AND (v_monthly_living_max IS NULL OR COALESCE(v.monthly_living_usd, 0) <= v_monthly_living_max)
      AND (v_scholarship_available IS NULL OR v.scholarship_available = v_scholarship_available)
      AND (v_scholarship_type IS NULL OR v.scholarship_type = v_scholarship_type)
      AND (v_intake_months IS NULL OR v.intake_months && v_intake_months)
      AND (v_deadline_before IS NULL OR v.deadline_date <= v_deadline_before)
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM filtered
  ),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY 
      CASE WHEN v_partner_priority = 'prefer' AND f.partner_preferred THEN 0 ELSE 1 END,
      f.tuition_basis_min ASC NULLS LAST
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT 
    (SELECT total FROM counted),
    jsonb_agg(
      jsonb_build_object(
        'program_id', p.program_id,
        'university_id', p.university_id,
        'portal_url', p.portal_url,
        'country_code', p.country_code,
        'city', p.city,
        'degree_slug', p.degree_slug,
        'discipline_slug', p.discipline_slug,
        'study_mode', p.study_mode,
        'duration_months', p.duration_months,
        'instruction_languages', p.instruction_languages,
        'intake_months', p.intake_months,
        'deadline_date', p.deadline_date,
        'tuition_basis', v_tuition_basis,
        'tuition_usd_min', p.tuition_basis_min,
        'tuition_usd_max', p.tuition_basis_max,
        'tuition_display_min', ROUND(p.tuition_basis_min / v_fx_rate, 2),
        'tuition_display_max', ROUND(p.tuition_basis_max / v_fx_rate, 2),
        'tuition_is_free', p.tuition_is_free,
        'has_dorm', p.has_dorm,
        'dorm_price_monthly_usd', p.dorm_price_monthly_usd,
        'monthly_living_usd', p.monthly_living_usd,
        'scholarship_available', p.scholarship_available,
        'scholarship_type', p.scholarship_type,
        'partner_tier', p.partner_tier,
        'partner_preferred', p.partner_preferred,
        'display_name', p.display_name,
        'university_name', p.university_name,
        'lang_requested', v_display_lang,
        'lang_served', p.lang_served_val,
        'i18n_status', p.i18n_status_val,
        'eligibility_status', 'eligible',
        'eligibility_reasons', '[]'::jsonb
      )
    )
  INTO v_total, v_items
  FROM paged p;
  
  v_count := COALESCE(jsonb_array_length(v_items), 0);
  IF v_items IS NULL THEN v_items := '[]'::jsonb; END IF;
  
  -- ============================================
  -- 13. BUILD RESPONSE (FLAT CONTRACT v1.3)
  -- ============================================
  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'meta', jsonb_build_object(
      'count', v_count,
      'total', v_total,
      'display_lang', v_display_lang,
      'display_currency_code', v_display_currency,
      'duration_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_ts))::int
    ),
    'items', v_items,
    'applied_filters', jsonb_build_object(
      'tuition_usd_min', v_tuition_usd_min,
      'tuition_usd_max', v_tuition_usd_max,
      'tuition_basis', v_tuition_basis,
      'partner_priority', v_partner_priority,
      'country_code', v_country_code,
      'city', v_city,
      'degree_slug', v_degree_slug,
      'discipline_slug', v_discipline_slug,
      'study_mode', v_study_mode,
      'instruction_languages', v_instruction_languages,
      'duration_months_max', v_duration_months_max,
      'has_dorm', v_has_dorm,
      'dorm_price_monthly_usd_max', v_dorm_price_max,
      'monthly_living_usd_max', v_monthly_living_max,
      'scholarship_available', v_scholarship_available,
      'scholarship_type', v_scholarship_type,
      'intake_months', v_intake_months,
      'deadline_before', v_deadline_before
    ),
    'ignored_filters', '[]'::jsonb,
    'missing_data_fields', '[]'::jsonb,
    'fx', jsonb_build_object(
      'usd_to_display_rate', ROUND(1.0 / v_fx_rate, 6),
      'display_to_usd_rate', ROUND(v_fx_rate, 6),
      'as_of', v_fx_as_of,
      'source', v_fx_source
    ),
    'capabilities', jsonb_build_object(
      'eligibility_engine', true,
      'fx_conversion', true,
      'i18n_fallback', true,
      'partner_boost', v_partner_priority = 'prefer'
    ),
    'has_next', (v_offset + v_count) < v_total,
    'next_offset', v_offset + v_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'INTERNAL_ERROR',
      'message', SQLERRM,
      'missing_data_fields', '[]'::jsonb,
      'ignored_filters', '[]'::jsonb
    );
END;
$$;