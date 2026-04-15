-- Restore full rpc_kb_programs_search_v1_3_final implementation (replaces erroneous TEMP_PATCH_APPLIED)

CREATE OR REPLACE FUNCTION public.rpc_kb_programs_search_v1_3_final(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request_id uuid;
  v_display_lang text;
  v_display_currency text;
  v_query text;

  v_filters jsonb;
  v_paging jsonb;
  v_limit int;
  v_offset int;

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

  v_intake_months int[];
  v_deadline_before date;

  -- Program requirements filters (tri-state)
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

  -- Results
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
  v_applied_filters jsonb := '{}'::jsonb;
  v_capabilities jsonb;
  v_start_time timestamptz := clock_timestamp();
  v_duration_ms int;

  v_view_name text := 'vw_program_search_api_v3_final';
BEGIN
  -- Gating: required view
  PERFORM public.kb_require_table('public.'||v_view_name);

  -- Contract fields
  IF payload ? 'request_id' THEN
    v_request_id := (payload->>'request_id')::uuid;
  ELSE
    RAISE EXCEPTION 'INVALID_INPUT: missing request_id';
  END IF;

  v_display_lang := NULLIF(payload->>'display_lang','');
  IF v_display_lang IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: missing display_lang';
  END IF;

  v_display_currency := UPPER(NULLIF(payload->>'display_currency_code',''));
  IF v_display_currency IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: missing display_currency_code';
  END IF;

  v_query := NULLIF(payload->>'query','');

  v_filters := COALESCE(payload->'program_filters', '{}'::jsonb);
  v_paging := COALESCE(payload->'paging', '{}'::jsonb);
  v_limit := LEAST(COALESCE((v_paging->>'limit')::int, 24), 50);
  v_offset := GREATEST(COALESCE((v_paging->>'offset')::int, 0), 0);

  -- Tuition mandatory
  v_tuition_usd_min := (v_filters->>'tuition_usd_min')::numeric;
  v_tuition_usd_max := (v_filters->>'tuition_usd_max')::numeric;
  v_tuition_basis := COALESCE(NULLIF(v_filters->>'tuition_basis',''), 'year');
  IF v_tuition_usd_min IS NULL OR v_tuition_usd_max IS NULL OR v_tuition_basis IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: tuition_usd_min/tuition_usd_max/tuition_basis are required';
  END IF;
  IF v_tuition_basis NOT IN ('year','semester','program_total') THEN
    RAISE EXCEPTION 'INVALID_INPUT: tuition_basis must be year|semester|program_total';
  END IF;

  -- Filters
  v_country_code := NULLIF(v_filters->>'country_code','');
  v_city := NULLIF(v_filters->>'city','');
  v_degree_slug := NULLIF(v_filters->>'degree_slug','');
  v_discipline_slug := NULLIF(v_filters->>'discipline_slug','');
  v_study_mode := NULLIF(v_filters->>'study_mode','');

  IF v_filters->'instruction_languages_any' IS NOT NULL THEN
    SELECT array_agg(elem::text) INTO v_instruction_languages
    FROM jsonb_array_elements_text(v_filters->'instruction_languages_any') elem;
  END IF;

  v_duration_months_max := (v_filters->>'duration_months_max')::int;
  v_has_dorm := (v_filters->>'has_dorm')::boolean;
  v_dorm_price_max := (v_filters->>'dorm_price_monthly_usd_max')::numeric;
  v_monthly_living_max := (v_filters->>'monthly_living_usd_max')::numeric;

  v_scholarship_available := (v_filters->>'scholarship_available')::boolean;
  v_scholarship_type := NULLIF(v_filters->>'scholarship_type','');

  v_partner_priority := COALESCE(NULLIF(v_filters->>'partner_priority',''), 'prefer');
  IF v_partner_priority NOT IN ('prefer','only','ignore') THEN
    RAISE EXCEPTION 'INVALID_INPUT: partner_priority must be prefer|only|ignore';
  END IF;

  IF v_filters->'intake_months' IS NOT NULL THEN
    SELECT array_agg(elem::int) INTO v_intake_months
    FROM jsonb_array_elements_text(v_filters->'intake_months') elem;
  END IF;
  v_deadline_before := (v_filters->>'deadline_before')::date;

  v_prep_req := NULLIF(v_filters->>'prep_year_required','');
  v_foundation_req := NULLIF(v_filters->>'foundation_required','');
  v_exam_req := NULLIF(v_filters->>'entrance_exam_required','');

  IF v_filters->'entrance_exam_types_any' IS NOT NULL THEN
    SELECT array_agg(elem::text) INTO v_exam_types_any
    FROM jsonb_array_elements_text(v_filters->'entrance_exam_types_any') elem;
  END IF;

  -- Admission policy
  v_policy := COALESCE(payload->'admission_policy', '{}'::jsonb);
  v_enforce_eligibility := COALESCE((v_policy->>'enforce_eligibility')::boolean, false);
  v_allow_unknown_as_pass := COALESCE((v_policy->>'allow_unknown_as_pass')::boolean, false);
  v_eligibility_filter_mode := COALESCE(NULLIF(v_policy->>'eligibility_filter_mode',''), 'hard_filter');

  IF v_allow_unknown_as_pass IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'INVALID_INPUT: allow_unknown_as_pass must be false';
  END IF;
  IF v_eligibility_filter_mode IS DISTINCT FROM 'hard_filter' THEN
    RAISE EXCEPTION 'INVALID_INPUT: eligibility_filter_mode must be hard_filter';
  END IF;

  IF v_enforce_eligibility THEN
    v_applicant := payload->'applicant_profile';
    IF v_applicant IS NULL THEN
      RAISE EXCEPTION 'INVALID_INPUT: missing applicant_profile';
    END IF;

    v_curriculum := NULLIF(v_applicant->>'curriculum','');
    v_stream := NULLIF(v_applicant->>'stream','');
    v_citizenship := UPPER(NULLIF(v_applicant->>'citizenship_country_code',''));

    PERFORM public.kb_require_table('public.admission_rules_country');
    PERFORM public.kb_require_table('public.admission_rules_university');
    PERFORM public.kb_require_table('public.admission_rules_program');

    IF v_country_code IS NULL THEN
      RAISE EXCEPTION USING
        message='MISSING_DATA_FIELDS',
        detail=jsonb_build_array('admission_rules_country:requires_country_code_filter')::text;
    END IF;

    SELECT requirement_set INTO v_country_req
    FROM public.admission_rules_country arc
    WHERE arc.is_active = true
      AND UPPER(arc.country_code) = UPPER(v_country_code)
      AND arc.curriculum = COALESCE(v_curriculum, arc.curriculum)
      AND arc.stream = COALESCE(v_stream, arc.stream)
      AND (arc.citizenship_country_code IS NULL OR arc.citizenship_country_code = v_citizenship)
      AND (arc.discipline_slug IS NULL OR arc.discipline_slug = v_discipline_slug)
      AND (arc.degree_slug IS NULL OR arc.degree_slug = v_degree_slug)
    ORDER BY arc.priority ASC, arc.created_at DESC
    LIMIT 1;

    IF v_country_req IS NULL THEN
      RAISE EXCEPTION USING
        message='MISSING_DATA_FIELDS',
        detail=jsonb_build_array(
          'admission_rules_country:missing_match:'||UPPER(v_country_code)||':curriculum='||COALESCE(v_curriculum,'')||':stream='||COALESCE(v_stream,'')
        )::text;
    END IF;
  END IF;

  -- FX (fail-closed)
  IF v_display_currency <> 'USD' THEN
    PERFORM public.kb_require_table('public.fx_rates_latest');

    SELECT rate_to_usd, as_of_date, source
      INTO v_display_to_usd_rate, v_fx_as_of, v_fx_source
    FROM public.fx_rates_latest
    WHERE currency_code = v_display_currency;

    IF v_display_to_usd_rate IS NULL OR v_display_to_usd_rate <= 0 THEN
      RAISE EXCEPTION USING
        message='MISSING_DATA_FIELDS',
        detail=jsonb_build_array('fx_rates_latest.'||v_display_currency)::text;
    END IF;

    v_usd_to_display_rate := 1.0 / v_display_to_usd_rate;
  ELSE
    v_display_to_usd_rate := 1;
    v_usd_to_display_rate := 1;
    v_fx_as_of := NULL;
    v_fx_source := NULL;
  END IF;

  -- Basis gating
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

  -- applied_filters (truthful)
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

  -- Main query (count + page)
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
      (v.display_name_i18n->>v_display_lang) AS name_exact,
      (v.display_name_i18n->>'en') AS name_en,
      (v.display_name_i18n->>'ar') AS name_ar,
      (v.university_display_name_i18n->>v_display_lang) AS uni_name_exact,
      (v.university_display_name_i18n->>'en') AS uni_name_en,
      (v.university_display_name_i18n->>'ar') AS uni_name_ar
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
      AND (
        v_prep_req IS NULL OR v_prep_req = 'either' OR v.prep_year_required = (v_prep_req::boolean)
      )
      AND (
        v_foundation_req IS NULL OR v_foundation_req = 'either' OR v.foundation_required = (v_foundation_req::boolean)
      )
      AND (
        v_exam_req IS NULL OR v_exam_req = 'either' OR v.entrance_exam_required = (v_exam_req::boolean)
      )
      AND (v_exam_types_any IS NULL OR v.entrance_exam_types && v_exam_types_any)
      AND (
        v_query IS NULL OR (
          v.program_name_ar ILIKE '%' || v_query || '%' OR
          v.program_name_en ILIKE '%' || v_query || '%' OR
          v.university_name_ar ILIKE '%' || v_query || '%' OR
          v.university_name_en ILIKE '%' || v_query || '%'
        )
      )
      -- Tuition mandatory range on selected basis (fail-closed if missing and not free)
      AND (
        (v.tuition_is_free = true) OR
        (CASE v_tuition_basis
          WHEN 'year' THEN (v.tuition_usd_year_min IS NOT NULL AND v.tuition_usd_year_max IS NOT NULL)
          WHEN 'semester' THEN (v.tuition_usd_semester_min IS NOT NULL AND v.tuition_usd_semester_max IS NOT NULL)
          ELSE (v.tuition_usd_program_total_min IS NOT NULL AND v.tuition_usd_program_total_max IS NOT NULL)
        END)
      )
      AND (
        (v.tuition_is_free = true) OR
        (COALESCE(
          CASE v_tuition_basis
            WHEN 'year' THEN v.tuition_usd_year_min
            WHEN 'semester' THEN v.tuition_usd_semester_min
            ELSE v.tuition_usd_program_total_min
          END, 0
        ) >= v_tuition_usd_min
        AND
        (CASE v_tuition_basis
          WHEN 'year' THEN v.tuition_usd_year_max
          WHEN 'semester' THEN v.tuition_usd_semester_max
          ELSE v.tuition_usd_program_total_max
        END) <= v_tuition_usd_max)
      )
  ), elig AS (
    SELECT b.*,
      CASE WHEN v_enforce_eligibility THEN
        (COALESCE(v_country_req,'{}'::jsonb)
          || COALESCE(uru.requirement_set,'{}'::jsonb)
          || COALESCE(pru.requirement_set,'{}'::jsonb))
      ELSE NULL END AS requirement_set
    FROM base b
    LEFT JOIN LATERAL (
      SELECT aru.requirement_set
      FROM public.admission_rules_university aru
      WHERE aru.university_id = b.university_id AND aru.is_active = true
      ORDER BY aru.priority ASC, aru.created_at DESC
      LIMIT 1
    ) uru ON true
    LEFT JOIN LATERAL (
      SELECT arp.requirement_set
      FROM public.admission_rules_program arp
      WHERE arp.program_id = b.program_id AND arp.is_active = true
      ORDER BY arp.created_at DESC
      LIMIT 1
    ) pru ON true
  ), eligible AS (
    SELECT e.*,
      CASE WHEN v_enforce_eligibility THEN
        (array_length(ARRAY_REMOVE(ARRAY[
          CASE WHEN v_curriculum IS NULL THEN 'missing_curriculum' END,
          CASE WHEN v_stream IS NULL THEN 'missing_stream' END,
          CASE WHEN e.prep_year_required = true AND COALESCE((v_applicant->>'accepts_prep_year')::boolean, false) = false THEN 'prep_year_required_but_student_rejects' END,
          CASE WHEN e.foundation_required = true AND COALESCE((v_applicant->>'accepts_foundation')::boolean, false) = false THEN 'foundation_required_but_student_rejects' END,
          CASE WHEN e.entrance_exam_required = true AND COALESCE((v_applicant->>'accepts_entrance_exam')::boolean, false) = false THEN 'entrance_exam_required_but_student_rejects' END,
          CASE WHEN (e.requirement_set ? 'min_ielts') AND (v_applicant->'language_tests'->'ielts'->>'overall') IS NULL THEN 'missing_ielts_overall' END,
          CASE WHEN (e.requirement_set ? 'min_ielts') AND (v_applicant->'language_tests'->'ielts'->>'valid_until') IS NOT NULL AND (v_applicant->'language_tests'->'ielts'->>'valid_until')::date < current_date THEN 'ielts_expired' END,
          CASE WHEN (e.requirement_set ? 'min_ielts') AND (v_applicant->'language_tests'->'ielts'->>'overall') IS NOT NULL AND ((v_applicant->'language_tests'->'ielts'->>'overall')::numeric) < ((e.requirement_set->>'min_ielts')::numeric) THEN 'ielts_below_min' END,
          CASE WHEN (e.requirement_set ? 'min_toefl_ibt') AND (v_applicant->'language_tests'->'toefl_ibt'->>'overall') IS NULL THEN 'missing_toefl_ibt_overall' END,
          CASE WHEN (e.requirement_set ? 'min_toefl_ibt') AND (v_applicant->'language_tests'->'toefl_ibt'->>'valid_until') IS NOT NULL AND (v_applicant->'language_tests'->'toefl_ibt'->>'valid_until')::date < current_date THEN 'toefl_ibt_expired' END,
          CASE WHEN (e.requirement_set ? 'min_toefl_ibt') AND (v_applicant->'language_tests'->'toefl_ibt'->>'overall') IS NOT NULL AND ((v_applicant->'language_tests'->'toefl_ibt'->>'overall')::numeric) < ((e.requirement_set->>'min_toefl_ibt')::numeric) THEN 'toefl_ibt_below_min' END
        ], NULL), 1) IS NULL)
      ELSE true END AS eligibility_ok,

      CASE WHEN v_enforce_eligibility THEN
        ARRAY_REMOVE(ARRAY[
          CASE WHEN v_curriculum IS NULL THEN 'missing_curriculum' END,
          CASE WHEN v_stream IS NULL THEN 'missing_stream' END,
          CASE WHEN e.prep_year_required = true AND COALESCE((v_applicant->>'accepts_prep_year')::boolean, false) = false THEN 'prep_year_required_but_student_rejects' END,
          CASE WHEN e.foundation_required = true AND COALESCE((v_applicant->>'accepts_foundation')::boolean, false) = false THEN 'foundation_required_but_student_rejects' END,
          CASE WHEN e.entrance_exam_required = true AND COALESCE((v_applicant->>'accepts_entrance_exam')::boolean, false) = false THEN 'entrance_exam_required_but_student_rejects' END,
          CASE WHEN (e.requirement_set ? 'min_ielts') AND (v_applicant->'language_tests'->'ielts'->>'overall') IS NULL THEN 'missing_ielts_overall' END,
          CASE WHEN (e.requirement_set ? 'min_ielts') AND (v_applicant->'language_tests'->'ielts'->>'valid_until') IS NOT NULL AND (v_applicant->'language_tests'->'ielts'->>'valid_until')::date < current_date THEN 'ielts_expired' END,
          CASE WHEN (e.requirement_set ? 'min_ielts') AND (v_applicant->'language_tests'->'ielts'->>'overall') IS NOT NULL AND ((v_applicant->'language_tests'->'ielts'->>'overall')::numeric) < ((e.requirement_set->>'min_ielts')::numeric) THEN 'ielts_below_min' END,
          CASE WHEN (e.requirement_set ? 'min_toefl_ibt') AND (v_applicant->'language_tests'->'toefl_ibt'->>'overall') IS NULL THEN 'missing_toefl_ibt_overall' END,
          CASE WHEN (e.requirement_set ? 'min_toefl_ibt') AND (v_applicant->'language_tests'->'toefl_ibt'->>'valid_until') IS NOT NULL AND (v_applicant->'language_tests'->'toefl_ibt'->>'valid_until')::date < current_date THEN 'toefl_ibt_expired' END,
          CASE WHEN (e.requirement_set ? 'min_toefl_ibt') AND (v_applicant->'language_tests'->'toefl_ibt'->>'overall') IS NOT NULL AND ((v_applicant->'language_tests'->'toefl_ibt'->>'overall')::numeric) < ((e.requirement_set->>'min_toefl_ibt')::numeric) THEN 'toefl_ibt_below_min' END
        ], NULL)
      ELSE NULL END AS eligibility_reasons
    FROM elig e
  ), filtered AS (
    SELECT *
    FROM eligible z
    WHERE (NOT v_enforce_eligibility) OR z.eligibility_ok = true
  ), ordered AS (
    SELECT *
    FROM filtered
    ORDER BY
      CASE WHEN v_partner_priority = 'prefer' THEN
        CASE WHEN partner_preferred THEN 0 ELSE 1 END
      ELSE 0 END,
      COALESCE(priority_score, 0) DESC,
      COALESCE(ranking, 9999) ASC
  ), paged AS (
    SELECT *
    FROM ordered
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT
    (SELECT COUNT(*) FROM ordered) AS total,
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'program_id', p.program_id,
        'university_id', p.university_id,
        'country_code', p.country_code,
        'city', p.city,
        'degree_slug', p.degree_slug,
        'discipline_slug', p.discipline_slug,
        'study_mode', p.study_mode,
        'instruction_languages', p.instruction_languages,
        'display_name_i18n', p.display_name_i18n,
        'university_display_name_i18n', p.university_display_name_i18n,
        'program_name', COALESCE(p.name_exact, p.name_en, p.name_ar, p.program_name_en, p.program_name_ar),
        'university_name', COALESCE(p.uni_name_exact, p.uni_name_en, p.uni_name_ar, p.university_name_en, p.university_name_ar),
        'tuition_basis', v_tuition_basis,
        'tuition_usd_min', p.tuition_basis_min,
        'tuition_usd_max', p.tuition_basis_max,
        'tuition_display_min', CASE WHEN p.tuition_is_free THEN 0 ELSE ROUND(COALESCE(p.tuition_basis_min, 0) * v_usd_to_display_rate) END,
        'tuition_display_max', CASE WHEN p.tuition_is_free THEN 0 ELSE ROUND(COALESCE(p.tuition_basis_max, 0) * v_usd_to_display_rate) END,
        'tuition_is_free', p.tuition_is_free,
        'duration_months', p.duration_months,
        'has_dorm', p.has_dorm,
        'dorm_price_monthly_usd', p.dorm_price_monthly_usd,
        'dorm_price_monthly_display', ROUND(COALESCE(p.dorm_price_monthly_usd, 0) * v_usd_to_display_rate),
        'monthly_living_usd', p.monthly_living_usd,
        'monthly_living_display', ROUND(COALESCE(p.monthly_living_usd, 0) * v_usd_to_display_rate),
        'scholarship_available', p.scholarship_available,
        'scholarship_type', p.scholarship_type,
        'partner_star', p.partner_star,
        'partner_tier', p.partner_tier,
        'partner_preferred', p.partner_preferred,
        'intake_months', p.intake_months,
        'deadline_date', p.deadline_date,
        'prep_year_required', p.prep_year_required,
        'foundation_required', p.foundation_required,
        'entrance_exam_required', p.entrance_exam_required,
        'entrance_exam_types', p.entrance_exam_types,
        'portal_url', p.portal_url,
        'ranking', p.ranking,
        'lang_requested', v_display_lang,
        'lang_served', CASE WHEN (p.display_name_i18n ? v_display_lang) THEN v_display_lang
                            WHEN (p.display_name_i18n ? 'en') THEN 'en'
                            WHEN (p.display_name_i18n ? 'ar') THEN 'ar'
                            ELSE v_display_lang END,
        'i18n_status', CASE WHEN (p.display_name_i18n ? v_display_lang) THEN 'exact'
                            WHEN (p.display_name_i18n ? 'en') OR (p.display_name_i18n ? 'ar') THEN 'fallback'
                            ELSE 'missing' END,
        'eligibility', CASE WHEN v_enforce_eligibility THEN jsonb_build_object('status','eligible','reasons','[]'::jsonb) ELSE NULL END
      )
    ), '[]'::jsonb) AS items
  INTO v_total, v_items
  FROM paged p;

  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::int;

  v_capabilities := jsonb_build_object(
    'supported_filters', ARRAY[
      'country_code','city','degree_slug','discipline_slug','study_mode',
      'instruction_languages_any',
      'tuition_usd_min','tuition_usd_max','tuition_basis',
      'duration_months_max',
      'has_dorm','dorm_price_monthly_usd_max','monthly_living_usd_max',
      'scholarship_available','scholarship_type',
      'partner_priority',
      'intake_months','deadline_before',
      'prep_year_required','foundation_required','entrance_exam_required','entrance_exam_types_any',
      'applicant_profile','admission_policy'
    ],
    'supports_intake_deadline', true,
    'supports_fx', true,
    'supports_scholarships', true,
    'supports_program_requirements', true,
    'supports_admission_rules', true,
    'enforces_do_not_offer', true,
    'eligibility_filter_mode', 'hard_filter'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'meta', jsonb_build_object(
      'count', jsonb_array_length(v_items),
      'total', v_total,
      'display_lang', v_display_lang,
      'display_currency_code', v_display_currency,
      'duration_ms', v_duration_ms
    ),
    'items', v_items,
    'applied_filters', v_applied_filters,
    'ignored_filters', '[]'::jsonb,
    'missing_data_fields', '[]'::jsonb,
    'fx', jsonb_build_object(
      'usd_to_display_rate', v_usd_to_display_rate,
      'display_to_usd_rate', v_display_to_usd_rate,
      'as_of', v_fx_as_of,
      'source', v_fx_source
    ),
    'capabilities', v_capabilities,
    'has_next', (v_offset + jsonb_array_length(v_items)) < v_total,
    'next_offset', v_offset + jsonb_array_length(v_items)
  );
END;
$$;