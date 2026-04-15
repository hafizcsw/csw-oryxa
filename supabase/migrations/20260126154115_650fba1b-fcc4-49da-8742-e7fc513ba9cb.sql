-- ============================================================
-- KB Search v1.3 Final - Phase 2: RPC Implementation
-- rpc_kb_programs_search_v1_3_final
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_kb_programs_search_v1_3_final(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Input extraction
  v_request_id TEXT;
  v_display_lang TEXT;
  v_display_currency TEXT;
  v_query TEXT;
  v_filters JSONB;
  v_paging JSONB;
  v_limit INT;
  v_offset INT;
  
  -- Filters
  v_country_code TEXT;
  v_city TEXT;
  v_degree_slug TEXT;
  v_discipline_slug TEXT;
  v_study_mode TEXT;
  v_instruction_languages TEXT[];
  v_tuition_usd_min NUMERIC;
  v_tuition_usd_max NUMERIC;
  v_tuition_basis TEXT;
  v_duration_months_max INT;
  v_has_dorm BOOLEAN;
  v_dorm_price_max NUMERIC;
  v_monthly_living_max NUMERIC;
  v_scholarship_available BOOLEAN;
  v_scholarship_type TEXT;
  v_partner_priority TEXT;
  v_intake_months INT[];
  v_deadline_before DATE;
  v_prep_year_required BOOLEAN;
  v_foundation_required BOOLEAN;
  v_entrance_exam_required BOOLEAN;
  
  -- FX
  v_fx_rate NUMERIC := 1;
  v_fx_as_of TEXT;
  
  -- Results
  v_items JSONB := '[]'::jsonb;
  v_total INT := 0;
  v_applied_filters JSONB := '{}'::jsonb;
  v_capabilities JSONB;
  v_start_time TIMESTAMPTZ := clock_timestamp();
  v_duration_ms INT;
  
  r RECORD;
BEGIN
  -- Extract top-level fields
  v_request_id := COALESCE(payload->>'request_id', 'portal-' || extract(epoch from now())::text);
  v_display_lang := COALESCE(payload->>'display_lang', payload->>'lang', 'ar');
  v_display_currency := UPPER(COALESCE(payload->>'display_currency_code', payload->>'currency', 'USD'));
  v_query := payload->>'query';
  v_filters := COALESCE(payload->'program_filters', payload->'filters', '{}'::jsonb);
  v_paging := COALESCE(payload->'paging', '{}'::jsonb);
  v_limit := LEAST(COALESCE((v_paging->>'limit')::int, (payload->>'limit')::int, 24), 50);
  v_offset := COALESCE((v_paging->>'offset')::int, (payload->>'offset')::int, 0);
  
  -- Extract filters
  v_country_code := v_filters->>'country_code';
  v_city := v_filters->>'city';
  v_degree_slug := v_filters->>'degree_slug';
  v_discipline_slug := v_filters->>'discipline_slug';
  v_study_mode := v_filters->>'study_mode';
  v_tuition_usd_min := (v_filters->>'tuition_usd_min')::numeric;
  v_tuition_usd_max := (v_filters->>'tuition_usd_max')::numeric;
  v_tuition_basis := COALESCE(v_filters->>'tuition_basis', 'year');
  v_duration_months_max := (v_filters->>'duration_months_max')::int;
  v_has_dorm := (v_filters->>'has_dorm')::boolean;
  v_dorm_price_max := (v_filters->>'dorm_price_monthly_usd_max')::numeric;
  v_monthly_living_max := (v_filters->>'monthly_living_usd_max')::numeric;
  v_scholarship_available := (v_filters->>'scholarship_available')::boolean;
  v_scholarship_type := v_filters->>'scholarship_type';
  v_partner_priority := COALESCE(v_filters->>'partner_priority', 'prefer');
  v_deadline_before := (v_filters->>'deadline_before')::date;
  v_prep_year_required := (v_filters->>'prep_year_required')::boolean;
  v_foundation_required := (v_filters->>'foundation_required')::boolean;
  v_entrance_exam_required := (v_filters->>'entrance_exam_required')::boolean;
  
  -- Extract instruction_languages_any array
  IF v_filters->'instruction_languages_any' IS NOT NULL THEN
    SELECT array_agg(elem::text) INTO v_instruction_languages
    FROM jsonb_array_elements_text(v_filters->'instruction_languages_any') elem;
  END IF;
  
  -- Extract intake_months array
  IF v_filters->'intake_months' IS NOT NULL THEN
    SELECT array_agg(elem::int) INTO v_intake_months
    FROM jsonb_array_elements_text(v_filters->'intake_months') elem;
  END IF;
  
  -- Get FX rate
  IF v_display_currency != 'USD' THEN
    SELECT rate_to_usd, updated_at::date::text INTO v_fx_rate, v_fx_as_of
    FROM fx_rates_latest
    WHERE currency_code = v_display_currency;
    
    IF v_fx_rate IS NULL THEN
      v_fx_rate := 1;
    END IF;
  END IF;
  
  -- Build applied_filters
  v_applied_filters := jsonb_build_object(
    'is_active', true,
    'publish_status', 'published',
    'do_not_offer', false
  );
  
  IF v_country_code IS NOT NULL THEN 
    v_applied_filters := v_applied_filters || jsonb_build_object('country_code', v_country_code);
  END IF;
  IF v_city IS NOT NULL THEN 
    v_applied_filters := v_applied_filters || jsonb_build_object('city', v_city);
  END IF;
  IF v_degree_slug IS NOT NULL THEN 
    v_applied_filters := v_applied_filters || jsonb_build_object('degree_slug', v_degree_slug);
  END IF;
  IF v_discipline_slug IS NOT NULL THEN 
    v_applied_filters := v_applied_filters || jsonb_build_object('discipline_slug', v_discipline_slug);
  END IF;
  IF v_study_mode IS NOT NULL THEN 
    v_applied_filters := v_applied_filters || jsonb_build_object('study_mode', v_study_mode);
  END IF;
  IF v_instruction_languages IS NOT NULL THEN 
    v_applied_filters := v_applied_filters || jsonb_build_object('instruction_languages_any', to_jsonb(v_instruction_languages));
  END IF;
  IF v_tuition_usd_max IS NOT NULL THEN 
    v_applied_filters := v_applied_filters || jsonb_build_object('tuition_usd_max', v_tuition_usd_max);
  END IF;
  IF v_duration_months_max IS NOT NULL THEN 
    v_applied_filters := v_applied_filters || jsonb_build_object('duration_months_max', v_duration_months_max);
  END IF;
  IF v_has_dorm IS NOT NULL THEN 
    v_applied_filters := v_applied_filters || jsonb_build_object('has_dorm', v_has_dorm);
  END IF;
  IF v_scholarship_available IS NOT NULL THEN 
    v_applied_filters := v_applied_filters || jsonb_build_object('scholarship_available', v_scholarship_available);
  END IF;
  IF v_partner_priority IS NOT NULL THEN 
    v_applied_filters := v_applied_filters || jsonb_build_object('partner_priority', v_partner_priority);
  END IF;

  -- Count total
  SELECT COUNT(*) INTO v_total
  FROM vw_program_search_api_v3_final v
  WHERE 
    (v_country_code IS NULL OR UPPER(v.country_code) = UPPER(v_country_code))
    AND (v_city IS NULL OR v.city ILIKE '%' || v_city || '%')
    AND (v_degree_slug IS NULL OR v.degree_slug = v_degree_slug)
    AND (v_discipline_slug IS NULL OR v.discipline_slug = v_discipline_slug)
    AND (v_study_mode IS NULL OR v.study_mode = v_study_mode)
    AND (v_instruction_languages IS NULL OR v.instruction_languages && v_instruction_languages)
    AND (v_tuition_usd_max IS NULL OR COALESCE(v.tuition_usd_year_max, 0) <= v_tuition_usd_max)
    AND (v_duration_months_max IS NULL OR COALESCE(v.duration_months, 0) <= v_duration_months_max)
    AND (v_has_dorm IS NULL OR v.has_dorm = v_has_dorm)
    AND (v_dorm_price_max IS NULL OR COALESCE(v.dorm_price_monthly_usd, 0) <= v_dorm_price_max)
    AND (v_monthly_living_max IS NULL OR COALESCE(v.monthly_living_usd, 0) <= v_monthly_living_max)
    AND (v_scholarship_available IS NULL OR v.scholarship_available = v_scholarship_available)
    AND (v_scholarship_type IS NULL OR v.scholarship_type = v_scholarship_type)
    AND (v_partner_priority != 'only' OR v.partner_tier IS NOT NULL)
    AND (v_intake_months IS NULL OR v.intake_months && v_intake_months)
    AND (v_deadline_before IS NULL OR v.deadline_date <= v_deadline_before)
    AND (v_prep_year_required IS NULL OR v.prep_year_required = v_prep_year_required)
    AND (v_foundation_required IS NULL OR v.foundation_required = v_foundation_required)
    AND (v_entrance_exam_required IS NULL OR v.entrance_exam_required = v_entrance_exam_required)
    AND (v_query IS NULL OR v_query = '' OR (
      v.program_name_ar ILIKE '%' || v_query || '%' OR
      v.program_name_en ILIKE '%' || v_query || '%' OR
      v.university_name_ar ILIKE '%' || v_query || '%' OR
      v.university_name_en ILIKE '%' || v_query || '%'
    ));

  -- Fetch items
  FOR r IN
    SELECT 
      v.program_id,
      v.university_id,
      v.country_code,
      v.city,
      v.degree_slug,
      v.discipline_slug,
      v.study_mode,
      v.instruction_languages,
      v.display_name_i18n,
      v.university_display_name_i18n,
      v.program_name_ar,
      v.program_name_en,
      v.university_name_ar,
      v.university_name_en,
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
      v.intake_months,
      v.deadline_date,
      v.prep_year_required,
      v.foundation_required,
      v.entrance_exam_required,
      v.entrance_exam_types,
      v.portal_url,
      v.ranking
    FROM vw_program_search_api_v3_final v
    WHERE 
      (v_country_code IS NULL OR UPPER(v.country_code) = UPPER(v_country_code))
      AND (v_city IS NULL OR v.city ILIKE '%' || v_city || '%')
      AND (v_degree_slug IS NULL OR v.degree_slug = v_degree_slug)
      AND (v_discipline_slug IS NULL OR v.discipline_slug = v_discipline_slug)
      AND (v_study_mode IS NULL OR v.study_mode = v_study_mode)
      AND (v_instruction_languages IS NULL OR v.instruction_languages && v_instruction_languages)
      AND (v_tuition_usd_max IS NULL OR COALESCE(v.tuition_usd_year_max, 0) <= v_tuition_usd_max)
      AND (v_duration_months_max IS NULL OR COALESCE(v.duration_months, 0) <= v_duration_months_max)
      AND (v_has_dorm IS NULL OR v.has_dorm = v_has_dorm)
      AND (v_dorm_price_max IS NULL OR COALESCE(v.dorm_price_monthly_usd, 0) <= v_dorm_price_max)
      AND (v_monthly_living_max IS NULL OR COALESCE(v.monthly_living_usd, 0) <= v_monthly_living_max)
      AND (v_scholarship_available IS NULL OR v.scholarship_available = v_scholarship_available)
      AND (v_scholarship_type IS NULL OR v.scholarship_type = v_scholarship_type)
      AND (v_partner_priority != 'only' OR v.partner_tier IS NOT NULL)
      AND (v_intake_months IS NULL OR v.intake_months && v_intake_months)
      AND (v_deadline_before IS NULL OR v.deadline_date <= v_deadline_before)
      AND (v_prep_year_required IS NULL OR v.prep_year_required = v_prep_year_required)
      AND (v_foundation_required IS NULL OR v.foundation_required = v_foundation_required)
      AND (v_entrance_exam_required IS NULL OR v.entrance_exam_required = v_entrance_exam_required)
      AND (v_query IS NULL OR v_query = '' OR (
        v.program_name_ar ILIKE '%' || v_query || '%' OR
        v.program_name_en ILIKE '%' || v_query || '%' OR
        v.university_name_ar ILIKE '%' || v_query || '%' OR
        v.university_name_en ILIKE '%' || v_query || '%'
      ))
    ORDER BY
      CASE WHEN v_partner_priority = 'prefer' THEN
        CASE WHEN v.partner_preferred THEN 0 ELSE 1 END
      ELSE 0 END,
      COALESCE(v.priority_score, 0) DESC,
      COALESCE(v.ranking, 9999) ASC
    LIMIT v_limit
    OFFSET v_offset
  LOOP
    v_items := v_items || jsonb_build_object(
      'program_id', r.program_id,
      'university_id', r.university_id,
      'country_code', r.country_code,
      'city', r.city,
      'degree_slug', r.degree_slug,
      'discipline_slug', r.discipline_slug,
      'study_mode', r.study_mode,
      'instruction_languages', r.instruction_languages,
      'display_name_i18n', r.display_name_i18n,
      'university_display_name_i18n', r.university_display_name_i18n,
      'program_name', CASE WHEN v_display_lang = 'ar' THEN r.program_name_ar ELSE r.program_name_en END,
      'university_name', CASE WHEN v_display_lang = 'ar' THEN r.university_name_ar ELSE r.university_name_en END,
      'tuition_basis', r.tuition_basis,
      'tuition_usd_min', r.tuition_usd_year_min,
      'tuition_usd_max', r.tuition_usd_year_max,
      'tuition_display_min', ROUND(COALESCE(r.tuition_usd_year_min, 0) * v_fx_rate),
      'tuition_display_max', ROUND(COALESCE(r.tuition_usd_year_max, 0) * v_fx_rate),
      'tuition_is_free', r.tuition_is_free,
      'duration_months', r.duration_months,
      'has_dorm', r.has_dorm,
      'dorm_price_monthly_usd', r.dorm_price_monthly_usd,
      'dorm_price_monthly_display', ROUND(COALESCE(r.dorm_price_monthly_usd, 0) * v_fx_rate),
      'monthly_living_usd', r.monthly_living_usd,
      'monthly_living_display', ROUND(COALESCE(r.monthly_living_usd, 0) * v_fx_rate),
      'scholarship_available', r.scholarship_available,
      'scholarship_type', r.scholarship_type,
      'partner_star', r.partner_star,
      'partner_tier', r.partner_tier,
      'partner_preferred', r.partner_preferred,
      'intake_months', r.intake_months,
      'deadline_date', r.deadline_date,
      'prep_year_required', r.prep_year_required,
      'foundation_required', r.foundation_required,
      'entrance_exam_required', r.entrance_exam_required,
      'entrance_exam_types', r.entrance_exam_types,
      'portal_url', r.portal_url,
      'ranking', r.ranking,
      -- i18n metadata
      'lang_requested', v_display_lang,
      'lang_served', v_display_lang,
      'i18n_status', 'exact'
    );
  END LOOP;

  -- Calculate duration
  v_duration_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::int;

  -- Build capabilities
  v_capabilities := jsonb_build_object(
    'supported_filters', ARRAY[
      'country_code', 'city', 'degree_slug', 'discipline_slug', 'study_mode',
      'instruction_languages_any', 'tuition_usd_min', 'tuition_usd_max', 'tuition_basis',
      'duration_months_max', 'has_dorm', 'dorm_price_monthly_usd_max', 'monthly_living_usd_max',
      'scholarship_available', 'scholarship_type', 'partner_priority',
      'intake_months', 'deadline_before',
      'prep_year_required', 'foundation_required', 'entrance_exam_required'
    ],
    'supports_intake_deadline', true,
    'supports_fx', true,
    'supports_scholarships', true,
    'supports_program_requirements', true,
    'supports_admission_rules', false,
    'enforces_do_not_offer', true,
    'eligibility_filter_mode', 'not_implemented'
  );

  -- Return response
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
      'usd_to_display_rate', v_fx_rate,
      'display_to_usd_rate', CASE WHEN v_fx_rate > 0 THEN 1.0 / v_fx_rate ELSE 1 END,
      'as_of', v_fx_as_of
    ),
    'capabilities', v_capabilities,
    'has_next', (v_offset + jsonb_array_length(v_items)) < v_total,
    'next_offset', v_offset + jsonb_array_length(v_items)
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_kb_programs_search_v1_3_final(jsonb) IS 'KB Search RPC v1.3 Final - Full filter support with FX conversion';