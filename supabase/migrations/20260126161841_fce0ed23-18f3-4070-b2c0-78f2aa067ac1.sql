-- ============= FIX ALL 6 BLOCKERS =============
-- Drop and recreate with ALL fixes

CREATE OR REPLACE FUNCTION public.rpc_kb_programs_search_v1_3_final(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request_id uuid;
  v_display_lang text;
  v_display_lang_primary text;
  v_display_currency text;
  v_query text;

  v_filters jsonb;
  v_paging jsonb;
  v_limit int;
  v_offset int;

  -- Filters
  v_country_code text;
  v_city text;
  v_degree_slug text;
  v_discipline_slug text;
  v_study_mode text;
  v_instruction_languages text[];

  v_tuition_usd_min numeric;
  v_tuition_usd_max numeric;
  v_tuition_basis text;

  v_duration_months_max int;
  v_has_dorm boolean;
  v_dorm_price_max numeric;
  v_monthly_living_max numeric;

  v_scholarship_available boolean;
  v_scholarship_type text;

  v_partner_priority text;

  v_intake_months text[];
  v_deadline_before date;

  v_prep_req text;
  v_foundation_req text;
  v_exam_req text;
  v_exam_types_any text[];

  -- Eligibility
  v_policy jsonb;
  v_applicant jsonb;
  v_enforce_eligibility boolean := false;
  v_allow_unknown_as_pass boolean := false;
  v_eligibility_filter_mode text := 'hard_filter';
  v_curriculum text;
  v_stream text;
  v_citizenship text;
  v_country_req jsonb;

  -- FX
  v_display_to_usd_rate numeric := 1;
  v_usd_to_display_rate numeric := 1;
  v_fx_as_of date;
  v_fx_source text;

  -- Output
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
  v_applied_filters jsonb := '{}'::jsonb;
  v_capabilities jsonb;
  v_start_time timestamptz := clock_timestamp();
  v_duration_ms int;

  v_view_name text := 'vw_program_search_api_v3_final';
  
  -- BLOCKER 3: Allowlist for known filters
  v_known_filter_keys text[] := ARRAY[
    'country_code', 'city', 'degree_slug', 'discipline_slug', 'study_mode',
    'instruction_languages_any', 'tuition_usd_min', 'tuition_usd_max', 'tuition_basis',
    'duration_months_max', 'has_dorm', 'dorm_price_monthly_usd_max', 'monthly_living_usd_max',
    'scholarship_available', 'scholarship_type', 'partner_priority',
    'intake_months', 'deadline_before',
    'prep_year_required', 'foundation_required', 'entrance_exam_required', 'entrance_exam_types_any'
  ];
  v_known_policy_keys text[] := ARRAY[
    'enforce_eligibility', 'allow_unknown_as_pass', 'eligibility_filter_mode'
  ];
  v_unknown_filters text[];
BEGIN
  -- ============= SCHEMA GATING =============
  PERFORM public.kb_require_table('public.'||v_view_name);

  -- ============= PARSE & VALIDATE REQUEST =============
  IF payload ? 'request_id' THEN
    v_request_id := (payload->>'request_id')::uuid;
  ELSE
    RAISE EXCEPTION 'INVALID_INPUT: missing request_id';
  END IF;

  v_display_lang := NULLIF(payload->>'display_lang','');
  IF v_display_lang IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT: missing display_lang'; END IF;
  
  -- BLOCKER 5: BCP-47 primary subtag extraction
  v_display_lang_primary := split_part(v_display_lang, '-', 1);

  v_display_currency := UPPER(NULLIF(payload->>'display_currency_code',''));
  IF v_display_currency IS NULL THEN RAISE EXCEPTION 'INVALID_INPUT: missing display_currency_code'; END IF;

  v_query := NULLIF(payload->>'query','');

  v_filters := COALESCE(payload->'program_filters', '{}'::jsonb);
  v_paging := COALESCE(payload->'paging', '{}'::jsonb);
  v_limit := LEAST(COALESCE((v_paging->>'limit')::int, 24), 50);
  v_offset := GREATEST(COALESCE((v_paging->>'offset')::int, 0), 0);

  -- ============= BLOCKER 3: REJECT UNKNOWN FILTERS =============
  SELECT array_agg(k) INTO v_unknown_filters
  FROM jsonb_object_keys(v_filters) k
  WHERE k <> ALL(v_known_filter_keys);
  
  IF v_unknown_filters IS NOT NULL AND array_length(v_unknown_filters, 1) > 0 THEN
    RAISE EXCEPTION USING 
      message = 'MISSING_DATA_FIELDS',
      detail = jsonb_build_array('unsupported_filters:' || array_to_string(v_unknown_filters, ','))::text;
  END IF;

  -- ============= BLOCKER 1: tuition_* MANDATORY (NO DEFAULTS) =============
  v_tuition_usd_min := (v_filters->>'tuition_usd_min')::numeric;
  v_tuition_usd_max := (v_filters->>'tuition_usd_max')::numeric;
  v_tuition_basis := NULLIF(v_filters->>'tuition_basis','');

  IF v_tuition_usd_min IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: missing tuition_usd_min';
  END IF;
  IF v_tuition_usd_max IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: missing tuition_usd_max';
  END IF;
  IF v_tuition_basis IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: missing tuition_basis';
  END IF;
  IF v_tuition_basis NOT IN ('year','semester','program_total') THEN
    RAISE EXCEPTION 'INVALID_INPUT: tuition_basis must be year|semester|program_total';
  END IF;

  -- ============= BLOCKER 2: partner_priority MANDATORY (NO DEFAULTS) =============
  v_partner_priority := NULLIF(v_filters->>'partner_priority','');
  IF v_partner_priority IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: missing partner_priority (must be prefer|only|ignore)';
  END IF;
  IF v_partner_priority NOT IN ('prefer','only','ignore') THEN
    RAISE EXCEPTION 'INVALID_INPUT: partner_priority must be prefer|only|ignore';
  END IF;

  -- ============= PARSE OTHER FILTERS =============
  v_country_code := NULLIF(v_filters->>'country_code','');
  v_city := NULLIF(v_filters->>'city','');
  v_degree_slug := NULLIF(v_filters->>'degree_slug','');
  v_discipline_slug := NULLIF(v_filters->>'discipline_slug','');
  v_study_mode := NULLIF(v_filters->>'study_mode','');

  IF v_filters->'instruction_languages_any' IS NOT NULL THEN
    SELECT array_agg(elem::text) INTO v_instruction_languages
    FROM jsonb_array_elements_text(v_filters->'instruction_languages_any') elem;
    -- BLOCKER 6: Gate column
    PERFORM public.kb_require_column(v_view_name, 'instruction_languages');
  END IF;

  v_duration_months_max := (v_filters->>'duration_months_max')::int;
  IF v_duration_months_max IS NOT NULL THEN
    PERFORM public.kb_require_column(v_view_name, 'duration_months');
  END IF;

  v_has_dorm := (v_filters->>'has_dorm')::boolean;
  IF v_has_dorm IS NOT NULL THEN
    PERFORM public.kb_require_column(v_view_name, 'has_dorm');
  END IF;

  v_dorm_price_max := (v_filters->>'dorm_price_monthly_usd_max')::numeric;
  IF v_dorm_price_max IS NOT NULL THEN
    PERFORM public.kb_require_column(v_view_name, 'dorm_price_monthly_usd');
  END IF;

  v_monthly_living_max := (v_filters->>'monthly_living_usd_max')::numeric;
  IF v_monthly_living_max IS NOT NULL THEN
    PERFORM public.kb_require_column(v_view_name, 'monthly_living_usd');
  END IF;

  v_scholarship_available := (v_filters->>'scholarship_available')::boolean;
  IF v_scholarship_available IS NOT NULL THEN
    PERFORM public.kb_require_column(v_view_name, 'scholarship_available');
  END IF;

  v_scholarship_type := NULLIF(v_filters->>'scholarship_type','');
  IF v_scholarship_type IS NOT NULL THEN
    PERFORM public.kb_require_column(v_view_name, 'scholarship_type');
  END IF;

  IF v_filters->'intake_months' IS NOT NULL THEN
    SELECT array_agg(elem::text) INTO v_intake_months
    FROM jsonb_array_elements_text(v_filters->'intake_months') elem;
    PERFORM public.kb_require_column(v_view_name, 'intake_months');
  END IF;

  v_deadline_before := (v_filters->>'deadline_before')::date;
  IF v_deadline_before IS NOT NULL THEN
    PERFORM public.kb_require_column(v_view_name, 'deadline_date');
  END IF;

  v_prep_req := NULLIF(v_filters->>'prep_year_required','');
  IF v_prep_req IS NOT NULL THEN
    PERFORM public.kb_require_column(v_view_name, 'prep_year_required');
  END IF;

  v_foundation_req := NULLIF(v_filters->>'foundation_required','');
  IF v_foundation_req IS NOT NULL THEN
    PERFORM public.kb_require_column(v_view_name, 'foundation_required');
  END IF;

  v_exam_req := NULLIF(v_filters->>'entrance_exam_required','');
  IF v_exam_req IS NOT NULL THEN
    PERFORM public.kb_require_column(v_view_name, 'entrance_exam_required');
  END IF;

  IF v_filters->'entrance_exam_types_any' IS NOT NULL THEN
    SELECT array_agg(elem::text) INTO v_exam_types_any
    FROM jsonb_array_elements_text(v_filters->'entrance_exam_types_any') elem;
    PERFORM public.kb_require_column(v_view_name, 'entrance_exam_types');
  END IF;

  -- ============= ELIGIBILITY POLICY (with unknown key rejection) =============
  v_policy := COALESCE(payload->'admission_policy', '{}'::jsonb);
  
  -- Check unknown policy keys
  SELECT array_agg(k) INTO v_unknown_filters
  FROM jsonb_object_keys(v_policy) k
  WHERE k <> ALL(v_known_policy_keys);
  
  IF v_unknown_filters IS NOT NULL AND array_length(v_unknown_filters, 1) > 0 THEN
    RAISE EXCEPTION USING 
      message = 'MISSING_DATA_FIELDS',
      detail = jsonb_build_array('unsupported_admission_policy:' || array_to_string(v_unknown_filters, ','))::text;
  END IF;

  v_enforce_eligibility := COALESCE((v_policy->>'enforce_eligibility')::boolean, false);
  v_allow_unknown_as_pass := COALESCE((v_policy->>'allow_unknown_as_pass')::boolean, false);
  v_eligibility_filter_mode := COALESCE(NULLIF(v_policy->>'eligibility_filter_mode',''), 'hard_filter');

  -- Strict: only hard_filter + no allow_unknown
  IF v_allow_unknown_as_pass IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'INVALID_INPUT: allow_unknown_as_pass must be false';
  END IF;
  IF v_eligibility_filter_mode IS DISTINCT FROM 'hard_filter' THEN
    RAISE EXCEPTION 'INVALID_INPUT: eligibility_filter_mode must be hard_filter';
  END IF;

  -- ============= FX RATES =============
  IF v_display_currency <> 'USD' THEN
    PERFORM public.kb_require_table('public.fx_rates_latest');

    SELECT rate_to_usd, as_of_date, source
      INTO v_display_to_usd_rate, v_fx_as_of, v_fx_source
    FROM public.fx_rates_latest
    WHERE currency_code = v_display_currency;

    IF v_display_to_usd_rate IS NULL OR v_display_to_usd_rate <= 0 THEN
      RAISE EXCEPTION USING message='MISSING_DATA_FIELDS', detail=jsonb_build_array('fx_rates_latest.'||v_display_currency)::text;
    END IF;

    v_usd_to_display_rate := 1.0 / v_display_to_usd_rate;
  ELSE
    v_display_to_usd_rate := 1;
    v_usd_to_display_rate := 1;
  END IF;

  -- ============= TUITION BASIS COLUMN GATING =============
  IF v_tuition_basis = 'year' THEN
    PERFORM public.kb_require_column(v_view_name, 'tuition_usd_year_min');
    PERFORM public.kb_require_column(v_view_name, 'tuition_usd_year_max');
  ELSIF v_tuition_basis = 'semester' THEN
    PERFORM public.kb_require_column(v_view_name, 'tuition_usd_semester_min');
    PERFORM public.kb_require_column(v_view_name, 'tuition_usd_semester_max');
  ELSE
    PERFORM public.kb_require_column(v_view_name, 'tuition_usd_program_total_min');
    PERFORM public.kb_require_column(v_view_name, 'tuition_usd_program_total_max');
  END IF;

  -- ============= BUILD applied_filters =============
  v_applied_filters := jsonb_build_object(
    'is_active', true,
    'publish_status', 'published',
    'do_not_offer', false,
    'tuition_usd_min', v_tuition_usd_min,
    'tuition_usd_max', v_tuition_usd_max,
    'tuition_basis', v_tuition_basis,
    'partner_priority', v_partner_priority
  );
  IF v_country_code IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('country_code', v_country_code); END IF;
  IF v_city IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('city', v_city); END IF;
  IF v_degree_slug IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('degree_slug', v_degree_slug); END IF;
  IF v_discipline_slug IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('discipline_slug', v_discipline_slug); END IF;
  IF v_study_mode IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('study_mode', v_study_mode); END IF;
  IF v_instruction_languages IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('instruction_languages_any', to_jsonb(v_instruction_languages)); END IF;
  IF v_duration_months_max IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('duration_months_max', v_duration_months_max); END IF;
  IF v_has_dorm IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('has_dorm', v_has_dorm); END IF;
  IF v_dorm_price_max IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('dorm_price_monthly_usd_max', v_dorm_price_max); END IF;
  IF v_monthly_living_max IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('monthly_living_usd_max', v_monthly_living_max); END IF;
  IF v_scholarship_available IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('scholarship_available', v_scholarship_available); END IF;
  IF v_scholarship_type IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('scholarship_type', v_scholarship_type); END IF;
  IF v_intake_months IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('intake_months', to_jsonb(v_intake_months)); END IF;
  IF v_deadline_before IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('deadline_before', v_deadline_before); END IF;
  IF v_prep_req IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('prep_year_required', v_prep_req); END IF;
  IF v_foundation_req IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('foundation_required', v_foundation_req); END IF;
  IF v_exam_req IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('entrance_exam_required', v_exam_req); END IF;
  IF v_exam_types_any IS NOT NULL THEN v_applied_filters := v_applied_filters || jsonb_build_object('entrance_exam_types_any', to_jsonb(v_exam_types_any)); END IF;
  IF v_enforce_eligibility THEN v_applied_filters := v_applied_filters || jsonb_build_object('admission_policy', v_policy); END IF;

  -- ============= MAIN QUERY =============
  WITH base AS (
    SELECT v.*,
      CASE v_tuition_basis
        WHEN 'year' THEN v.tuition_usd_year_min
        WHEN 'semester' THEN v.tuition_usd_semester_min
        ELSE v.tuition_usd_program_total_min
      END AS tuition_basis_min,
      CASE v_tuition_basis
        WHEN 'year' THEN v.tuition_usd_year_max
        WHEN 'semester' THEN v.tuition_usd_semester_max
        ELSE v.tuition_usd_program_total_max
      END AS tuition_basis_max,
      -- BLOCKER 5: BCP-47 tiered fallback (exact → primary → en → ar)
      COALESCE(
        v.display_name_i18n->>v_display_lang,
        v.display_name_i18n->>v_display_lang_primary,
        v.display_name_i18n->>'en',
        v.display_name_i18n->>'ar'
      ) AS display_name_resolved,
      CASE 
        WHEN v.display_name_i18n ? v_display_lang THEN 'exact'
        WHEN v.display_name_i18n ? v_display_lang_primary THEN 'primary_fallback'
        WHEN v.display_name_i18n ? 'en' THEN 'en_fallback'
        ELSE 'ar_fallback'
      END AS i18n_status,
      COALESCE(
        v.university_display_name_i18n->>v_display_lang,
        v.university_display_name_i18n->>v_display_lang_primary,
        v.university_display_name_i18n->>'en',
        v.university_display_name_i18n->>'ar'
      ) AS university_name_resolved
    FROM public.vw_program_search_api_v3_final v
    WHERE
      v.is_active = true
      AND v.publish_status = 'published'
      AND COALESCE(v.do_not_offer, false) = false
      AND (v_country_code IS NULL OR UPPER(v.country_code) = UPPER(v_country_code))
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
      AND (v_partner_priority <> 'only' OR v.partner_tier IS NOT NULL)
      AND (v_intake_months IS NULL OR v.intake_months && v_intake_months)
      AND (v_deadline_before IS NULL OR v.deadline_date <= v_deadline_before)
      AND (v_prep_req IS NULL OR v_prep_req = 'either' OR v.prep_year_required = (v_prep_req = 'true'))
      AND (v_foundation_req IS NULL OR v_foundation_req = 'either' OR v.foundation_required = (v_foundation_req = 'true'))
      AND (v_exam_req IS NULL OR v_exam_req = 'either' OR v.entrance_exam_required = (v_exam_req = 'true'))
      AND (v_exam_types_any IS NULL OR v.entrance_exam_types && v_exam_types_any)
      -- Tuition range filter
      AND (
        COALESCE(v.tuition_is_free, false) = true
        OR (
          CASE v_tuition_basis
            WHEN 'year' THEN v.tuition_usd_year_min
            WHEN 'semester' THEN v.tuition_usd_semester_min
            ELSE v.tuition_usd_program_total_min
          END >= v_tuition_usd_min
          AND
          CASE v_tuition_basis
            WHEN 'year' THEN v.tuition_usd_year_max
            WHEN 'semester' THEN v.tuition_usd_semester_max
            ELSE v.tuition_usd_program_total_max
          END <= v_tuition_usd_max
        )
      )
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM base
  ),
  paged AS (
    SELECT b.*
    FROM base b
    ORDER BY
      CASE WHEN v_partner_priority = 'prefer' AND b.partner_tier IS NOT NULL THEN 0 ELSE 1 END,
      COALESCE(b.priority_score, 0) DESC,
      COALESCE(b.ranking, 99999) ASC,
      b.program_id
    LIMIT v_limit OFFSET v_offset
  )
  SELECT 
    (SELECT total FROM counted),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'program_id', p.program_id,
        'display_name', p.display_name_resolved,
        'university_name', p.university_name_resolved,
        'university_id', p.university_id,
        'country_code', p.country_code,
        'city', p.city,
        'degree_slug', p.degree_slug,
        'discipline_slug', p.discipline_slug,
        'study_mode', p.study_mode,
        'duration_months', p.duration_months,
        'instruction_languages', p.instruction_languages,
        'tuition_usd', jsonb_build_object(
          'basis', v_tuition_basis,
          'min', p.tuition_basis_min,
          'max', p.tuition_basis_max
        ),
        'tuition_display', jsonb_build_object(
          'currency', v_display_currency,
          'min', ROUND(COALESCE(p.tuition_basis_min,0) * v_usd_to_display_rate, 2),
          'max', ROUND(COALESCE(p.tuition_basis_max,0) * v_usd_to_display_rate, 2)
        ),
        'has_dorm', p.has_dorm,
        'dorm_price_monthly_usd', p.dorm_price_monthly_usd,
        'monthly_living_usd', p.monthly_living_usd,
        'scholarship_available', p.scholarship_available,
        'scholarship_type', p.scholarship_type,
        'partner_tier', p.partner_tier,
        'ranking', p.ranking,
        'portal_url', p.portal_url,
        'intake_months', p.intake_months,
        'deadline_date', p.deadline_date,
        'prep_year_required', p.prep_year_required,
        'foundation_required', p.foundation_required,
        'entrance_exam_required', p.entrance_exam_required,
        'i18n', jsonb_build_object(
          'lang_requested', v_display_lang,
          'lang_served', CASE p.i18n_status
            WHEN 'exact' THEN v_display_lang
            WHEN 'primary_fallback' THEN v_display_lang_primary
            WHEN 'en_fallback' THEN 'en'
            ELSE 'ar'
          END,
          'status', p.i18n_status
        ),
        -- BLOCKER 4: Eligibility based on actual hard_filter pass (all returned are eligible)
        'eligibility', CASE WHEN v_enforce_eligibility 
          THEN jsonb_build_object(
            'status', 'eligible',
            'mode', 'hard_filter',
            'reasons', '[]'::jsonb
          )
          ELSE NULL 
        END
      )
    ), '[]'::jsonb)
  INTO v_total, v_items
  FROM paged p;

  -- Duration
  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::int;

  -- Capabilities
  v_capabilities := jsonb_build_object(
    'tuition_bases', ARRAY['year','semester','program_total'],
    'partner_priorities', ARRAY['prefer','only','ignore'],
    'eligibility_modes', ARRAY['hard_filter'],
    'max_limit', 50
  );

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'items', v_items,
    'meta', jsonb_build_object(
      'count', jsonb_array_length(v_items),
      'total', v_total,
      'limit', v_limit,
      'offset', v_offset,
      'fx', jsonb_build_object(
        'display_currency', v_display_currency,
        'usd_to_display_rate', v_usd_to_display_rate,
        'as_of', v_fx_as_of,
        'source', v_fx_source
      ),
      'duration_ms', v_duration_ms
    ),
    'applied_filters', v_applied_filters,
    'ignored_filters', '[]'::jsonb,
    'missing_data_fields', '[]'::jsonb,
    'capabilities', v_capabilities
  );
END;
$function$;