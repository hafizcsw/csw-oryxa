-- Update RPC to add Fail-Closed validation for applicant_profile and paging keys
CREATE OR REPLACE FUNCTION public.rpc_kb_programs_search_v1_3_final(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  -- Request metadata
  v_request_id text;
  v_display_lang text;
  v_display_currency text;
  
  -- Input sections
  v_program_filters jsonb;
  v_admission_policy jsonb;
  v_applicant_profile jsonb;
  v_paging jsonb;
  
  -- Validation
  v_missing_fields text[] := ARRAY[]::text[];
  v_unknown_keys text[];
  
  -- Allow-lists (Fail-Closed)
  v_known_program_filters text[] := ARRAY[
    'tuition_basis', 'tuition_usd_min', 'tuition_usd_max',
    'partner_priority', 'country_codes', 'degree_slugs', 'discipline_slugs',
    'language_codes', 'has_scholarship', 'has_dorm'
  ];
  v_known_admission_policy text[] := ARRAY['enforce_eligibility'];
  v_known_applicant_profile text[] := ARRAY['curriculum', 'stream'];
  v_known_paging text[] := ARRAY['limit', 'offset'];
  
  -- Filter values
  v_tuition_basis text;
  v_tuition_usd_min numeric;
  v_tuition_usd_max numeric;
  v_partner_priority text;
  v_enforce_eligibility boolean;
  v_curriculum text;
  v_stream text;
  
  -- Paging
  v_limit int;
  v_offset int;
  
  -- FX
  v_fx_rate numeric;
  v_fx_date date;
  v_fx_source text;
  
  -- Results
  v_total int;
  v_items jsonb;
  v_applied_filters jsonb;
  v_has_next boolean;
  v_next_offset int;
  v_start_time timestamptz := clock_timestamp();
  v_duration_ms int;
BEGIN
  -- ============= STEP 0: Extract sections =============
  v_request_id := COALESCE(payload->>'request_id', 'unknown');
  v_display_lang := payload->>'display_lang';
  v_display_currency := COALESCE(payload->>'display_currency_code', 'USD');
  v_program_filters := COALESCE(payload->'program_filters', '{}'::jsonb);
  v_admission_policy := COALESCE(payload->'admission_policy', '{}'::jsonb);
  v_applicant_profile := COALESCE(payload->'applicant_profile', '{}'::jsonb);
  v_paging := COALESCE(payload->'paging', '{}'::jsonb);

  -- ============= STEP 1: Mandatory field validation =============
  IF v_display_lang IS NULL OR v_display_lang = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'display_lang');
  END IF;

  -- Tuition fields are mandatory
  IF NOT (v_program_filters ? 'tuition_usd_min') THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_usd_min');
  END IF;
  IF NOT (v_program_filters ? 'tuition_usd_max') THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_usd_max');
  END IF;
  IF NOT (v_program_filters ? 'tuition_basis') THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.tuition_basis');
  END IF;
  IF NOT (v_program_filters ? 'partner_priority') THEN
    v_missing_fields := array_append(v_missing_fields, 'program_filters.partner_priority');
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

  -- ============= STEP 2: Reject unknown keys (Fail-Closed) =============
  
  -- program_filters: reject unknown keys
  SELECT array_agg(k) INTO v_unknown_keys
  FROM jsonb_object_keys(v_program_filters) AS t(k)
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

  -- admission_policy: reject unknown keys
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

  -- applicant_profile must be object
  IF jsonb_typeof(v_applicant_profile) <> 'object' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', to_jsonb(ARRAY['invalid_value.applicant_profile_must_be_object']),
      'ignored_filters', '[]'::jsonb
    );
  END IF;

  -- applicant_profile: reject unknown keys
  SELECT array_agg(k) INTO v_unknown_keys
  FROM jsonb_object_keys(v_applicant_profile) AS t(k)
  WHERE NOT (k = ANY(v_known_applicant_profile));

  IF v_unknown_keys IS NOT NULL AND array_length(v_unknown_keys, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', to_jsonb(ARRAY(SELECT 'unsupported_applicant_profile.' || unnest(v_unknown_keys))),
      'ignored_filters', '[]'::jsonb
    );
  END IF;

  -- paging must be object
  IF jsonb_typeof(v_paging) <> 'object' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', to_jsonb(ARRAY['invalid_value.paging_must_be_object']),
      'ignored_filters', '[]'::jsonb
    );
  END IF;

  -- paging: reject unknown keys
  SELECT array_agg(k) INTO v_unknown_keys
  FROM jsonb_object_keys(v_paging) AS t(k)
  WHERE NOT (k = ANY(v_known_paging));

  IF v_unknown_keys IS NOT NULL AND array_length(v_unknown_keys, 1) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'request_id', v_request_id,
      'error', 'MISSING_DATA_FIELDS',
      'missing_data_fields', to_jsonb(ARRAY(SELECT 'unsupported_paging.' || unnest(v_unknown_keys))),
      'ignored_filters', '[]'::jsonb
    );
  END IF;

  -- ============= STEP 3: Enum validation =============
  v_tuition_basis := v_program_filters->>'tuition_basis';
  v_partner_priority := v_program_filters->>'partner_priority';

  IF v_tuition_basis NOT IN ('year', 'semester', 'program_total') THEN
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.tuition_basis');
  END IF;

  IF v_partner_priority NOT IN ('prefer', 'only', 'ignore') THEN
    v_missing_fields := array_append(v_missing_fields, 'invalid_value.partner_priority');
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

  -- ============= STEP 4: Extract filter values =============
  v_tuition_usd_min := (v_program_filters->>'tuition_usd_min')::numeric;
  v_tuition_usd_max := (v_program_filters->>'tuition_usd_max')::numeric;
  v_enforce_eligibility := COALESCE((v_admission_policy->>'enforce_eligibility')::boolean, true);
  v_curriculum := v_applicant_profile->>'curriculum';
  v_stream := v_applicant_profile->>'stream';

  -- ============= STEP 5: FX rate lookup =============
  IF v_display_currency = 'USD' THEN
    v_fx_rate := 1;
    v_fx_date := CURRENT_DATE;
    v_fx_source := 'identity';
  ELSE
    SELECT rate_to_usd, as_of INTO v_fx_rate, v_fx_date
    FROM fx_rates
    WHERE currency_code = v_display_currency
    ORDER BY as_of DESC
    LIMIT 1;

    IF v_fx_rate IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', to_jsonb(ARRAY['fx_rate_not_found.' || v_display_currency]),
        'ignored_filters', '[]'::jsonb
      );
    END IF;
    v_fx_source := 'fx_rates';
  END IF;

  -- ============= STEP 6: Paging with safe parsing (Fail-Closed) =============
  IF v_paging ? 'limit' THEN
    IF NULLIF(v_paging->>'limit', '') IS NULL OR (v_paging->>'limit') !~ '^\d+$' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', to_jsonb(ARRAY['invalid_value.paging.limit']),
        'ignored_filters', '[]'::jsonb
      );
    END IF;

    v_limit := (v_paging->>'limit')::int;
    IF v_limit < 1 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', to_jsonb(ARRAY['invalid_value.paging.limit']),
        'ignored_filters', '[]'::jsonb
      );
    END IF;

    v_limit := LEAST(v_limit, 50);
  ELSE
    v_limit := 24;
  END IF;

  IF v_paging ? 'offset' THEN
    IF NULLIF(v_paging->>'offset', '') IS NULL OR (v_paging->>'offset') !~ '^\d+$' THEN
      RETURN jsonb_build_object(
        'ok', false,
        'request_id', v_request_id,
        'error', 'MISSING_DATA_FIELDS',
        'missing_data_fields', to_jsonb(ARRAY['invalid_value.paging.offset']),
        'ignored_filters', '[]'::jsonb
      );
    END IF;

    v_offset := (v_paging->>'offset')::int;
  ELSE
    v_offset := 0;
  END IF;

  -- ============= STEP 7: Build applied_filters =============
  v_applied_filters := jsonb_build_object(
    'tuition_basis', v_tuition_basis,
    'tuition_usd_min', v_tuition_usd_min,
    'tuition_usd_max', v_tuition_usd_max,
    'partner_priority', v_partner_priority,
    'enforce_eligibility', v_enforce_eligibility,
    'curriculum', v_curriculum,
    'stream', v_stream,
    'limit', v_limit,
    'offset', v_offset
  );

  -- ============= STEP 8: Query with filters =============
  WITH filtered AS (
    SELECT *
    FROM vw_program_search_api_v3_final v
    WHERE v.do_not_offer = false
      AND (
        CASE v_tuition_basis
          WHEN 'year' THEN v.tuition_usd_year
          WHEN 'semester' THEN v.tuition_usd_semester
          WHEN 'program_total' THEN v.tuition_usd_program_total
        END
      ) BETWEEN v_tuition_usd_min AND v_tuition_usd_max
      AND (
        v_partner_priority = 'ignore'
        OR (v_partner_priority = 'prefer')
        OR (v_partner_priority = 'only' AND v.partner_preferred = true)
      )
      -- Optional filters
      AND (
        NOT (v_program_filters ? 'country_codes')
        OR v.country_code = ANY(ARRAY(SELECT jsonb_array_elements_text(v_program_filters->'country_codes')))
      )
      AND (
        NOT (v_program_filters ? 'degree_slugs')
        OR v.degree_slug = ANY(ARRAY(SELECT jsonb_array_elements_text(v_program_filters->'degree_slugs')))
      )
      AND (
        NOT (v_program_filters ? 'discipline_slugs')
        OR v.discipline_slug = ANY(ARRAY(SELECT jsonb_array_elements_text(v_program_filters->'discipline_slugs')))
      )
      AND (
        NOT (v_program_filters ? 'language_codes')
        OR v.language_code = ANY(ARRAY(SELECT jsonb_array_elements_text(v_program_filters->'language_codes')))
      )
      AND (
        NOT (v_program_filters ? 'has_scholarship')
        OR v.has_scholarship = (v_program_filters->>'has_scholarship')::boolean
      )
      AND (
        NOT (v_program_filters ? 'has_dorm')
        OR v.has_dorm = (v_program_filters->>'has_dorm')::boolean
      )
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM filtered
  ),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY 
      CASE WHEN v_partner_priority = 'prefer' THEN 
        CASE WHEN f.partner_preferred THEN 0 ELSE 1 END 
      ELSE 0 END,
      f.university_rank_global NULLS LAST,
      f.program_id
    LIMIT v_limit + 1
    OFFSET v_offset
  )
  SELECT 
    c.total,
    jsonb_agg(
      jsonb_build_object(
        'program_id', p.program_id,
        'program_slug', p.program_slug,
        'portal_url', p.portal_url,
        'university_id', p.university_id,
        'university_slug', p.university_slug,
        'university_name_en', p.university_name_en,
        'university_name_ar', p.university_name_ar,
        'university_logo_url', p.university_logo_url,
        'university_rank_global', p.university_rank_global,
        'country_code', p.country_code,
        'country_name_en', p.country_name_en,
        'country_name_ar', p.country_name_ar,
        'degree_slug', p.degree_slug,
        'degree_name_en', p.degree_name_en,
        'degree_name_ar', p.degree_name_ar,
        'discipline_slug', p.discipline_slug,
        'discipline_name_en', p.discipline_name_en,
        'discipline_name_ar', p.discipline_name_ar,
        'program_name_en', p.program_name_en,
        'program_name_ar', p.program_name_ar,
        'program_name_native', p.program_name_native,
        'description_en', p.description_en,
        'description_ar', p.description_ar,
        'language_code', p.language_code,
        'duration_years', p.duration_years,
        'tuition_usd_year', COALESCE(p.tuition_usd_year, 0),
        'tuition_usd_semester', COALESCE(p.tuition_usd_semester, 0),
        'tuition_usd_program_total', COALESCE(p.tuition_usd_program_total, 0),
        'currency_code', p.currency_code,
        'tuition_local_year', COALESCE(p.tuition_local_year, 0),
        'tuition_local_semester', COALESCE(p.tuition_local_semester, 0),
        'tuition_local_program_total', COALESCE(p.tuition_local_program_total, 0),
        'has_scholarship', p.has_scholarship,
        'scholarship_details_en', p.scholarship_details_en,
        'scholarship_details_ar', p.scholarship_details_ar,
        'has_dorm', p.has_dorm,
        'dorm_price_monthly_usd', COALESCE(p.dorm_price_monthly_usd, 0),
        'monthly_living', COALESCE(p.monthly_living, 0),
        'partner_preferred', p.partner_preferred,
        'intake_months', p.intake_months,
        'application_deadline', p.application_deadline,
        'do_not_offer', p.do_not_offer
      )
    ) FILTER (WHERE row_number() OVER () <= v_limit)
  INTO v_total, v_items
  FROM paged p, counted c
  GROUP BY c.total;

  -- Handle empty results
  IF v_items IS NULL THEN
    v_items := '[]'::jsonb;
  END IF;
  IF v_total IS NULL THEN
    v_total := 0;
  END IF;

  -- Calculate pagination
  v_has_next := (v_offset + v_limit) < v_total;
  v_next_offset := CASE WHEN v_has_next THEN v_offset + v_limit ELSE NULL END;

  -- Calculate duration
  v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::int;

  -- ============= STEP 9: Return success response =============
  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'items', v_items,
    'meta', jsonb_build_object(
      'count', jsonb_array_length(v_items),
      'total', v_total,
      'duration_ms', v_duration_ms
    ),
    'fx', jsonb_build_object(
      'rate', v_fx_rate,
      'as_of', v_fx_date,
      'source', v_fx_source
    ),
    'applied_filters', v_applied_filters,
    'has_next', v_has_next,
    'next_offset', v_next_offset,
    'ignored_filters', '[]'::jsonb,
    'missing_data_fields', '[]'::jsonb
  );
END;
$function$;