-- ============================================================
-- FINAL RPC FIX: Conflicts + Column Gate + Tuition Overlap + Security
-- Contract: kb_search_v1_3_final_hardened
-- ============================================================

-- PHASE 1: Column Gate - Prevent future 500 errors
DO $$
DECLARE
  missing_cols text[] := '{}';
  required_cols text[] := ARRAY[
    'program_id', 'university_id', 'country_code', 'city',
    'degree_slug', 'discipline_slug', 'study_mode', 'instruction_languages',
    'tuition_usd_year_min', 'tuition_usd_year_max',
    'tuition_usd_semester_min', 'tuition_usd_semester_max',
    'tuition_usd_program_total_min', 'tuition_usd_program_total_max',
    'tuition_is_free', 'duration_months', 'has_dorm', 'dorm_price_monthly_usd',
    'monthly_living_usd', 'scholarship_available', 'scholarship_type',
    'partner_star', 'partner_tier', 'partner_preferred', 'priority_score',
    'do_not_offer', 'intake_months', 'deadline_date', 'portal_url',
    'publish_status', 'is_active', 'ranking'
  ];
  col text;
BEGIN
  FOREACH col IN ARRAY required_cols
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'vw_program_search_api_v3_final' 
      AND column_name = col
    ) THEN
      missing_cols := array_append(missing_cols, col);
    END IF;
  END LOOP;
  
  IF array_length(missing_cols, 1) > 0 THEN
    RAISE EXCEPTION 'COLUMN_GATE_FAILED: Missing required columns in vw_program_search_api_v3_final: %', missing_cols;
  END IF;
  
  RAISE NOTICE 'COLUMN_GATE_PASSED: All 32 required columns verified in view';
END $$;

-- PHASE 2: Hardened RPC with Conflicts + Overlap Tuition + Security
CREATE OR REPLACE FUNCTION public.rpc_kb_programs_search_v1_3_final(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_conflicts text[] := '{}';
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
  
  -- Filter values (final normalized)
  v_country_codes text[];
  v_city text;
  v_degree_slugs text[];
  v_discipline_slugs text[];
  v_study_mode text;
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
  v_intake_months text[];
  v_deadline_before date;
  
  -- Temp vars for conflict detection
  v_temp_singular text;
  v_temp_plural text[];
  v_temp_bool1 boolean;
  v_temp_bool2 boolean;
  
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
  
  -- Return early if missing required fields
  IF array_length(v_missing_fields, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', to_jsonb(v_missing_fields),
      'conflicts', '[]'::jsonb,
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
      'conflicts', '[]'::jsonb,
      'allowed_keys', to_jsonb(v_allowed_program_filter_keys)
    );
  END IF;
  
  -- ============= CONFLICT DETECTION (FAIL CLOSED) =============
  
  -- 1) country_code vs country_codes
  IF (v_program_filters ? 'country_code') AND (v_program_filters ? 'country_codes') THEN
    v_temp_singular := v_program_filters->>'country_code';
    SELECT array_agg(x) INTO v_temp_plural FROM jsonb_array_elements_text(v_program_filters->'country_codes') x;
    IF NOT (v_temp_singular = ANY(v_temp_plural)) THEN
      v_conflicts := array_append(v_conflicts, 'country_code/country_codes');
    END IF;
  END IF;
  
  -- 2) degree_slug vs degree_slugs
  IF (v_program_filters ? 'degree_slug') AND (v_program_filters ? 'degree_slugs') THEN
    v_temp_singular := v_program_filters->>'degree_slug';
    SELECT array_agg(x) INTO v_temp_plural FROM jsonb_array_elements_text(v_program_filters->'degree_slugs') x;
    IF NOT (v_temp_singular = ANY(v_temp_plural)) THEN
      v_conflicts := array_append(v_conflicts, 'degree_slug/degree_slugs');
    END IF;
  END IF;
  
  -- 3) discipline_slug vs discipline_slugs
  IF (v_program_filters ? 'discipline_slug') AND (v_program_filters ? 'discipline_slugs') THEN
    v_temp_singular := v_program_filters->>'discipline_slug';
    SELECT array_agg(x) INTO v_temp_plural FROM jsonb_array_elements_text(v_program_filters->'discipline_slugs') x;
    IF NOT (v_temp_singular = ANY(v_temp_plural)) THEN
      v_conflicts := array_append(v_conflicts, 'discipline_slug/discipline_slugs');
    END IF;
  END IF;
  
  -- 4) instruction_language vs instruction_languages
  IF (v_program_filters ? 'instruction_language') AND (v_program_filters ? 'instruction_languages') THEN
    v_temp_singular := v_program_filters->>'instruction_language';
    SELECT array_agg(x) INTO v_temp_plural FROM jsonb_array_elements_text(v_program_filters->'instruction_languages') x;
    IF NOT (v_temp_singular = ANY(v_temp_plural)) THEN
      v_conflicts := array_append(v_conflicts, 'instruction_language/instruction_languages');
    END IF;
  END IF;
  
  -- 5) language_codes vs instruction_languages (must match as sets)
  IF (v_program_filters ? 'language_codes') AND (v_program_filters ? 'instruction_languages') THEN
    DECLARE
      v_lang_codes text[];
      v_instr_langs text[];
    BEGIN
      SELECT array_agg(x ORDER BY x) INTO v_lang_codes FROM jsonb_array_elements_text(v_program_filters->'language_codes') x;
      SELECT array_agg(x ORDER BY x) INTO v_instr_langs FROM jsonb_array_elements_text(v_program_filters->'instruction_languages') x;
      IF v_lang_codes IS DISTINCT FROM v_instr_langs THEN
        v_conflicts := array_append(v_conflicts, 'language_codes/instruction_languages');
      END IF;
    END;
  END IF;
  
  -- 6) scholarship_available vs has_scholarship
  IF (v_program_filters ? 'scholarship_available') AND (v_program_filters ? 'has_scholarship') THEN
    v_temp_bool1 := (v_program_filters->>'scholarship_available')::boolean;
    v_temp_bool2 := (v_program_filters->>'has_scholarship')::boolean;
    IF v_temp_bool1 IS DISTINCT FROM v_temp_bool2 THEN
      v_conflicts := array_append(v_conflicts, 'scholarship_available/has_scholarship');
    END IF;
  END IF;
  
  -- Return if conflicts detected
  IF array_length(v_conflicts, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'CONFLICTS',
      'conflicts', to_jsonb(v_conflicts),
      'message', 'Conflicting filter keys detected. Provide either singular or plural, not both with different values.'
    );
  END IF;
  
  -- ============= NORMALIZE CRM KEYS TO INTERNAL =============
  
  -- Country: prefer plural, fallback to singular
  IF v_program_filters ? 'country_codes' THEN
    SELECT array_agg(x) INTO v_country_codes FROM jsonb_array_elements_text(v_program_filters->'country_codes') x;
  ELSIF v_program_filters ? 'country_code' THEN
    v_country_codes := ARRAY[v_program_filters->>'country_code'];
  END IF;
  
  -- Degree: prefer plural, fallback to singular
  IF v_program_filters ? 'degree_slugs' THEN
    SELECT array_agg(x) INTO v_degree_slugs FROM jsonb_array_elements_text(v_program_filters->'degree_slugs') x;
  ELSIF v_program_filters ? 'degree_slug' THEN
    v_degree_slugs := ARRAY[v_program_filters->>'degree_slug'];
  END IF;
  
  -- Discipline: prefer plural, fallback to singular
  IF v_program_filters ? 'discipline_slugs' THEN
    SELECT array_agg(x) INTO v_discipline_slugs FROM jsonb_array_elements_text(v_program_filters->'discipline_slugs') x;
  ELSIF v_program_filters ? 'discipline_slug' THEN
    v_discipline_slugs := ARRAY[v_program_filters->>'discipline_slug'];
  END IF;
  
  -- Language: prefer instruction_languages, then language_codes, then singular
  IF v_program_filters ? 'instruction_languages' THEN
    SELECT array_agg(x) INTO v_instruction_languages FROM jsonb_array_elements_text(v_program_filters->'instruction_languages') x;
  ELSIF v_program_filters ? 'language_codes' THEN
    SELECT array_agg(x) INTO v_instruction_languages FROM jsonb_array_elements_text(v_program_filters->'language_codes') x;
  ELSIF v_program_filters ? 'instruction_language' THEN
    v_instruction_languages := ARRAY[v_program_filters->>'instruction_language'];
  END IF;
  
  -- Scholarship: prefer scholarship_available, fallback to has_scholarship
  IF v_program_filters ? 'scholarship_available' THEN
    v_scholarship_available := (v_program_filters->>'scholarship_available')::boolean;
  ELSIF v_program_filters ? 'has_scholarship' THEN
    v_scholarship_available := (v_program_filters->>'has_scholarship')::boolean;
  END IF;
  
  -- Partner priority: default to 'ignore' if missing
  IF NOT (v_program_filters ? 'partner_priority') OR (v_program_filters->>'partner_priority') IS NULL THEN
    v_partner_priority := 'ignore';
    v_defaults_applied := array_append(v_defaults_applied, 'partner_priority');
  ELSE
    v_partner_priority := v_program_filters->>'partner_priority';
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
  v_deadline_before := (v_program_filters->>'deadline_before')::date;
  
  -- Intake months (text array)
  IF v_program_filters ? 'intake_months' THEN
    SELECT array_agg(x::text) INTO v_intake_months FROM jsonb_array_elements_text(v_program_filters->'intake_months') x;
  END IF;
  
  -- SECURITY: do_not_offer is IGNORED from user input (always exclude do_not_offer programs)
  -- This prevents bypass attacks. Only internal/service_role can show do_not_offer items.
  
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
    'do_not_offer', 'LOCKED_FALSE'
  );
  
  -- ============= EXECUTE QUERY =============
  -- TUITION FILTER: Using OVERLAP logic (any intersection = match)
  -- This provides balanced results without being too strict or too loose
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
      -- SECURITY: Always exclude do_not_offer (no user bypass allowed)
      v.do_not_offer = false
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
      -- Language filter using array overlap
      AND (v_instruction_languages IS NULL OR v.instruction_languages && v_instruction_languages)
      -- TUITION FILTER: OVERLAP LOGIC
      -- A program matches if there's ANY intersection between [program_min, program_max] and [budget_min, budget_max]
      AND (
        v_tuition_usd_max IS NULL 
        OR v.tuition_is_free = true
        OR (
          CASE v_tuition_basis
            WHEN 'year' THEN 
              -- Overlap: program_min <= budget_max AND program_max >= budget_min
              COALESCE(v.tuition_usd_year_min, 0) <= v_tuition_usd_max 
              AND COALESCE(v.tuition_usd_year_max, v.tuition_usd_year_min, 0) >= v_tuition_usd_min
            WHEN 'semester' THEN 
              COALESCE(v.tuition_usd_semester_min, 0) <= v_tuition_usd_max 
              AND COALESCE(v.tuition_usd_semester_max, v.tuition_usd_semester_min, 0) >= v_tuition_usd_min
            WHEN 'program_total' THEN 
              COALESCE(v.tuition_usd_program_total_min, 0) <= v_tuition_usd_max 
              AND COALESCE(v.tuition_usd_program_total_max, v.tuition_usd_program_total_min, 0) >= v_tuition_usd_min
            ELSE 
              COALESCE(v.tuition_usd_year_min, 0) <= v_tuition_usd_max 
              AND COALESCE(v.tuition_usd_year_max, v.tuition_usd_year_min, 0) >= v_tuition_usd_min
          END
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
      -- Scholarship filter
      AND (v_scholarship_available IS NULL OR v.scholarship_available = v_scholarship_available)
      -- Scholarship type filter
      AND (v_scholarship_type IS NULL OR v.scholarship_type = v_scholarship_type)
      -- Intake months filter (text array overlap)
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
    'blocked_filters', '["do_not_offer"]'::jsonb,
    'conflicts', '[]'::jsonb,
    'meta', jsonb_build_object(
      'count', jsonb_array_length(COALESCE(v_results->'items', '[]'::jsonb)),
      'total', v_total_count,
      'limit', v_limit,
      'offset', v_offset,
      'display_lang', v_display_lang,
      'display_currency_code', v_display_currency_code,
      'sot_view', 'vw_program_search_api_v3_final',
      'contract', 'kb_search_v1_3_final_hardened',
      'tuition_filter_logic', 'OVERLAP'
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'request_id', v_request_id,
    'error', 'RPC_INTERNAL_ERROR',
    'message', SQLERRM,
    'conflicts', '[]'::jsonb,
    'defaults_applied', to_jsonb(v_defaults_applied)
  );
END;
$function$;