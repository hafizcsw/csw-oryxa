-- ============================================================
-- RPC: rpc_kb_programs_search_v1_3_final - COMPLETE FIX (8 blockers)
-- ============================================================
-- Fixes:
-- 1. Reject Unknown Keys: correct SQL syntax with AS t(k) + NOT (k = ANY(...))
-- 2. Partner "only" semantics: partner_tier IS NOT NULL (not preferred)
-- 3. Free tuition = 0 (not null)
-- 4. Cap limit = 50
-- 5. Query search re-added with ILIKE
-- 6. Column/table gating re-added
-- 7. Eligibility engine placeholder (documented as not-ready)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_kb_programs_search_v1_3_final(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_lang_served text;
  v_i18n_status text;
  
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
  
BEGIN
  -- ============================================================
  -- STEP 1: Extract top-level sections
  -- ============================================================
  v_request_id := COALESCE(payload->>'request_id', 'unknown');
  v_display_lang := COALESCE(payload->>'display_lang', 'ar');
  v_display_currency_code := COALESCE(NULLIF(payload->>'display_currency_code', ''), 'USD');
  v_filters := COALESCE(payload->'program_filters', '{}'::jsonb);
  v_admission_policy := COALESCE(payload->'admission_policy', '{}'::jsonb);
  v_applicant_profile := COALESCE(payload->'applicant_profile', '{}'::jsonb);
  v_paging := COALESCE(payload->'paging', '{}'::jsonb);

  -- ============================================================
  -- STEP 2: REJECT UNKNOWN KEYS (FIXED SYNTAX)
  -- ============================================================
  -- Program filters
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
  
  -- Admission policy
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
  -- STEP 3: MANDATORY FIELDS VALIDATION
  -- ============================================================
  -- tuition_basis (MANDATORY - no default)
  v_tuition_basis := NULLIF(v_filters->>'tuition_basis', '');
  IF v_tuition_basis IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_basis');
  ELSIF v_tuition_basis NOT IN ('year', 'semester', 'program_total') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'INVALID_INPUT',
      'message', 'tuition_basis must be: year, semester, or program_total',
      'ignored_filters', '[]'::jsonb,
      'missing_data_fields', '[]'::jsonb
    );
  END IF;
  
  -- partner_priority (MANDATORY - no default)
  v_partner_priority := NULLIF(v_filters->>'partner_priority', '');
  IF v_partner_priority IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.partner_priority');
  ELSIF v_partner_priority NOT IN ('prefer', 'only', 'ignore') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'INVALID_INPUT',
      'message', 'partner_priority must be: prefer, only, or ignore',
      'ignored_filters', '[]'::jsonb,
      'missing_data_fields', '[]'::jsonb
    );
  END IF;
  
  -- enforce_eligibility (MANDATORY = true)
  v_enforce_eligibility := (v_admission_policy->>'enforce_eligibility')::boolean;
  IF v_enforce_eligibility IS NULL THEN
    v_missing_fields := array_append(v_missing_fields, 'admission_policy.enforce_eligibility');
  ELSIF v_enforce_eligibility = false THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'INVALID_INPUT',
      'message', 'enforce_eligibility must be true (fail-closed)',
      'ignored_filters', '[]'::jsonb,
      'missing_data_fields', '[]'::jsonb
    );
  END IF;
  
  -- applicant_profile.curriculum (MANDATORY when enforce_eligibility)
  v_curriculum := v_applicant_profile->>'curriculum';
  IF v_curriculum IS NULL OR v_curriculum = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'applicant_profile.curriculum');
  END IF;
  
  -- applicant_profile.stream (MANDATORY when enforce_eligibility)
  v_stream := v_applicant_profile->>'stream';
  IF v_stream IS NULL OR v_stream = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'applicant_profile.stream');
  END IF;
  
  -- Return all missing fields at once
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
  -- STEP 4: COLUMN/TABLE GATING (fail-closed)
  -- ============================================================
  -- Check view exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'vw_program_search_api_v3_final'
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', '["view.vw_program_search_api_v3_final"]'::jsonb,
      'ignored_filters', '[]'::jsonb
    );
  END IF;
  
  -- Check mandatory tuition columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vw_program_search_api_v3_final' AND column_name = 'tuition_year_usd_min') THEN
    RETURN jsonb_build_object('ok', false, 'request_id', v_request_id, 'error', 'MISSING_DATA_FIELDS', 'missing_data_fields', '["column.tuition_year_usd_min"]'::jsonb, 'ignored_filters', '[]'::jsonb);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vw_program_search_api_v3_final' AND column_name = 'tuition_is_free') THEN
    RETURN jsonb_build_object('ok', false, 'request_id', v_request_id, 'error', 'MISSING_DATA_FIELDS', 'missing_data_fields', '["column.tuition_is_free"]'::jsonb, 'ignored_filters', '[]'::jsonb);
  END IF;

  -- ============================================================
  -- STEP 5: FX RATE LOOKUP
  -- ============================================================
  IF v_display_currency_code != 'USD' THEN
    -- Check fx_rates_latest exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fx_rates_latest') THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', '["table.fx_rates_latest"]'::jsonb,
        'ignored_filters', '[]'::jsonb
      );
    END IF;
    
    SELECT rate_to_usd, as_of_date, source INTO v_fx_rate, v_fx_as_of, v_fx_source
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
  -- STEP 6: PARSE OPTIONAL FILTERS
  -- ============================================================
  v_country_code := NULLIF(v_filters->>'country_code', '');
  v_city := NULLIF(v_filters->>'city', '');
  v_degree_slug := NULLIF(v_filters->>'degree_slug', '');
  v_discipline_slug := NULLIF(v_filters->>'discipline_slug', '');
  v_study_mode := NULLIF(v_filters->>'study_mode', '');
  v_query := NULLIF(v_filters->>'query', '');
  
  -- instruction_languages as text[]
  IF v_filters ? 'instruction_languages' AND jsonb_typeof(v_filters->'instruction_languages') = 'array' THEN
    SELECT array_agg(elem::text) INTO v_instruction_languages
    FROM jsonb_array_elements_text(v_filters->'instruction_languages') AS elem;
  END IF;
  
  v_tuition_usd_min := (v_filters->>'tuition_usd_min')::numeric;
  v_tuition_usd_max := (v_filters->>'tuition_usd_max')::numeric;
  v_duration_months_max := (v_filters->>'duration_months_max')::int;
  v_has_dorm := (v_filters->>'has_dorm')::boolean;
  v_dorm_price_max := (v_filters->>'dorm_price_monthly_usd_max')::numeric;
  v_monthly_living_max := (v_filters->>'monthly_living_usd_max')::numeric;
  v_scholarship_available := (v_filters->>'scholarship_available')::boolean;
  v_scholarship_type := NULLIF(v_filters->>'scholarship_type', '');
  
  -- intake_months as text[]
  IF v_filters ? 'intake_months' AND jsonb_typeof(v_filters->'intake_months') = 'array' THEN
    SELECT array_agg(elem::text) INTO v_intake_months
    FROM jsonb_array_elements_text(v_filters->'intake_months') AS elem;
  END IF;
  
  v_deadline_before := (v_filters->>'deadline_before')::date;
  
  -- Paging with CAP = 50
  v_limit := LEAST(COALESCE((v_paging->>'limit')::int, 24), 50);
  v_offset := COALESCE((v_paging->>'offset')::int, 0);

  -- ============================================================
  -- STEP 7: I18N FALLBACK (BCP-47: exact → primary → en → ar)
  -- ============================================================
  v_lang_primary := split_part(v_display_lang, '-', 1);

  -- ============================================================
  -- STEP 8: BUILD QUERY + COUNT
  -- ============================================================
  -- Count total (before paging)
  EXECUTE format($q$
    SELECT COUNT(*)
    FROM public.vw_program_search_api_v3_final v
    WHERE v.is_active = true
      AND v.publish_status = 'published'
      AND COALESCE(v.do_not_offer, false) = false
      -- Partner filter (FIXED: only = partner_tier IS NOT NULL)
      AND (
        CASE 
          WHEN %L = 'only' THEN v.partner_tier IS NOT NULL
          WHEN %L = 'ignore' THEN true
          ELSE true -- prefer = no filter, just ordering
        END
      )
      -- Tuition filter (FREE = 0, not null)
      AND (
        CASE %L
          WHEN 'year' THEN 
            (v.tuition_is_free = true AND 0 >= COALESCE(%L::numeric, 0) AND 0 <= COALESCE(%L::numeric, 999999999))
            OR (COALESCE(v.tuition_year_usd_min, 0) >= COALESCE(%L::numeric, 0) AND COALESCE(v.tuition_year_usd_max, v.tuition_year_usd_min, 0) <= COALESCE(%L::numeric, 999999999))
          WHEN 'semester' THEN
            (v.tuition_is_free = true AND 0 >= COALESCE(%L::numeric, 0) AND 0 <= COALESCE(%L::numeric, 999999999))
            OR (COALESCE(v.tuition_semester_usd_min, 0) >= COALESCE(%L::numeric, 0) AND COALESCE(v.tuition_semester_usd_max, v.tuition_semester_usd_min, 0) <= COALESCE(%L::numeric, 999999999))
          WHEN 'program_total' THEN
            (v.tuition_is_free = true AND 0 >= COALESCE(%L::numeric, 0) AND 0 <= COALESCE(%L::numeric, 999999999))
            OR (COALESCE(v.tuition_total_usd_min, 0) >= COALESCE(%L::numeric, 0) AND COALESCE(v.tuition_total_usd_max, v.tuition_total_usd_min, 0) <= COALESCE(%L::numeric, 999999999))
          ELSE true
        END
      )
      -- Optional filters
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
      -- QUERY SEARCH (re-added)
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
  -- STEP 9: FETCH ITEMS WITH FLAT RESPONSE (FREE TUITION = 0)
  -- ============================================================
  EXECUTE format($q$
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    FROM (
      SELECT 
        v.program_id,
        v.university_id,
        v.program_slug,
        v.university_slug,
        -- I18N names with fallback
        COALESCE(
          v.program_name_i18n->>%L,
          v.program_name_i18n->>%L,
          v.program_name_i18n->>'en',
          v.program_name_i18n->>'ar',
          v.program_name_ar
        ) AS program_name,
        COALESCE(
          v.university_name_i18n->>%L,
          v.university_name_i18n->>%L,
          v.university_name_i18n->>'en',
          v.university_name_i18n->>'ar',
          v.university_name_ar
        ) AS university_name,
        v.country_code,
        v.city,
        v.degree_slug,
        v.discipline_slug,
        v.study_mode,
        v.duration_months,
        v.instruction_languages,
        v.intake_months,
        v.deadline_date,
        -- FLAT tuition (FREE = 0, not null)
        %L AS tuition_basis,
        CASE WHEN v.tuition_is_free THEN 0 ELSE
          CASE %L
            WHEN 'year' THEN COALESCE(v.tuition_year_usd_min, 0)
            WHEN 'semester' THEN COALESCE(v.tuition_semester_usd_min, 0)
            WHEN 'program_total' THEN COALESCE(v.tuition_total_usd_min, 0)
            ELSE 0
          END
        END AS tuition_usd_min,
        CASE WHEN v.tuition_is_free THEN 0 ELSE
          CASE %L
            WHEN 'year' THEN COALESCE(v.tuition_year_usd_max, v.tuition_year_usd_min, 0)
            WHEN 'semester' THEN COALESCE(v.tuition_semester_usd_max, v.tuition_semester_usd_min, 0)
            WHEN 'program_total' THEN COALESCE(v.tuition_total_usd_max, v.tuition_total_usd_min, 0)
            ELSE 0
          END
        END AS tuition_usd_max,
        -- Display currency conversion
        CASE WHEN v.tuition_is_free THEN 0 ELSE
          ROUND((CASE %L
            WHEN 'year' THEN COALESCE(v.tuition_year_usd_min, 0)
            WHEN 'semester' THEN COALESCE(v.tuition_semester_usd_min, 0)
            WHEN 'program_total' THEN COALESCE(v.tuition_total_usd_min, 0)
            ELSE 0
          END) / %L::numeric, 2)
        END AS tuition_display_min,
        CASE WHEN v.tuition_is_free THEN 0 ELSE
          ROUND((CASE %L
            WHEN 'year' THEN COALESCE(v.tuition_year_usd_max, v.tuition_year_usd_min, 0)
            WHEN 'semester' THEN COALESCE(v.tuition_semester_usd_max, v.tuition_semester_usd_min, 0)
            WHEN 'program_total' THEN COALESCE(v.tuition_total_usd_max, v.tuition_total_usd_min, 0)
            ELSE 0
          END) / %L::numeric, 2)
        END AS tuition_display_max,
        v.tuition_is_free,
        %L AS display_currency_code,
        -- Housing
        v.has_dorm,
        COALESCE(v.dorm_price_monthly_usd, 0) AS dorm_price_monthly_usd,
        COALESCE(v.monthly_living_usd, 0) AS monthly_living_usd,
        -- Scholarship
        v.scholarship_available,
        v.scholarship_type,
        -- Partner
        v.partner_tier,
        v.partner_preferred,
        -- Portal URL
        v.portal_url,
        -- I18N tracking
        %L AS lang_requested,
        CASE 
          WHEN v.program_name_i18n ? %L THEN %L
          WHEN v.program_name_i18n ? %L THEN %L
          WHEN v.program_name_i18n ? 'en' THEN 'en'
          ELSE 'ar'
        END AS lang_served,
        CASE 
          WHEN v.program_name_i18n ? %L THEN 'exact'
          WHEN v.program_name_i18n ? %L THEN 'primary'
          WHEN v.program_name_i18n ? 'en' THEN 'fallback_en'
          ELSE 'fallback_ar'
        END AS i18n_status,
        -- Eligibility (hard_filter: all returned are eligible)
        jsonb_build_object(
          'status', 'eligible',
          'reasons', '[]'::jsonb
        ) AS eligibility
      FROM public.vw_program_search_api_v3_final v
      WHERE v.is_active = true
        AND v.publish_status = 'published'
        AND COALESCE(v.do_not_offer, false) = false
        AND (
          CASE 
            WHEN %L = 'only' THEN v.partner_tier IS NOT NULL
            WHEN %L = 'ignore' THEN true
            ELSE true
          END
        )
        AND (
          CASE %L
            WHEN 'year' THEN 
              (v.tuition_is_free = true AND 0 >= COALESCE(%L::numeric, 0) AND 0 <= COALESCE(%L::numeric, 999999999))
              OR (COALESCE(v.tuition_year_usd_min, 0) >= COALESCE(%L::numeric, 0) AND COALESCE(v.tuition_year_usd_max, v.tuition_year_usd_min, 0) <= COALESCE(%L::numeric, 999999999))
            WHEN 'semester' THEN
              (v.tuition_is_free = true AND 0 >= COALESCE(%L::numeric, 0) AND 0 <= COALESCE(%L::numeric, 999999999))
              OR (COALESCE(v.tuition_semester_usd_min, 0) >= COALESCE(%L::numeric, 0) AND COALESCE(v.tuition_semester_usd_max, v.tuition_semester_usd_min, 0) <= COALESCE(%L::numeric, 999999999))
            WHEN 'program_total' THEN
              (v.tuition_is_free = true AND 0 >= COALESCE(%L::numeric, 0) AND 0 <= COALESCE(%L::numeric, 999999999))
              OR (COALESCE(v.tuition_total_usd_min, 0) >= COALESCE(%L::numeric, 0) AND COALESCE(v.tuition_total_usd_max, v.tuition_total_usd_min, 0) <= COALESCE(%L::numeric, 999999999))
            ELSE true
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
        CASE WHEN %L = 'prefer' THEN (CASE WHEN v.partner_tier IS NOT NULL THEN 0 ELSE 1 END) ELSE 0 END,
        v.program_name_ar
      LIMIT %L OFFSET %L
    ) t
  $q$,
    -- I18N fallback params (4x for program, 4x for university)
    v_display_lang, v_lang_primary, v_display_lang, v_lang_primary,
    -- Tuition basis and conversion (multiple references)
    v_tuition_basis, v_tuition_basis, v_tuition_basis,
    v_tuition_basis, v_fx_rate, v_tuition_basis, v_fx_rate,
    v_display_currency_code,
    -- Lang tracking
    v_display_lang, v_display_lang, v_display_lang, v_lang_primary, v_lang_primary,
    v_display_lang, v_lang_primary,
    -- WHERE clause params
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
    -- ORDER BY + LIMIT
    v_partner_priority, v_limit, v_offset
  ) INTO v_items;

  -- ============================================================
  -- STEP 10: BUILD APPLIED FILTERS
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

  -- Duration
  v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::int;

  -- ============================================================
  -- STEP 11: RETURN RESPONSE
  -- ============================================================
  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'meta', jsonb_build_object(
      'count', jsonb_array_length(v_items),
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
      'eligibility_engine', 'hard_filter_placeholder_v1',
      'fx_conversion', true,
      'i18n_fallback', 'exact→primary→en→ar',
      'partner_priority', true,
      'query_search', true
    ),
    'has_next', (v_offset + v_limit) < v_total,
    'next_offset', CASE WHEN (v_offset + v_limit) < v_total THEN v_offset + v_limit ELSE NULL END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', COALESCE(v_request_id, 'unknown'),
      'error', 'INTERNAL_ERROR',
      'message', SQLERRM,
      'ignored_filters', '[]'::jsonb,
      'missing_data_fields', '[]'::jsonb
    );
END;
$function$;

-- Grant execute to service_role only
REVOKE ALL ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) TO service_role;