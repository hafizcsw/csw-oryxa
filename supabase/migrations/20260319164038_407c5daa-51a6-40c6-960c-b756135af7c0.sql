
CREATE OR REPLACE FUNCTION rpc_promote_language_observations(
  _university_id uuid DEFAULT NULL,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promoted int := 0;
  v_skipped_uni_scope int := 0;
  v_skipped_no_program int := 0;
  v_skipped_duplicate int := 0;
  v_results jsonb := '[]'::jsonb;
  v_obs record;
  v_matched_program_id uuid;
  v_scope text;
  v_reason text;
BEGIN
  FOR v_obs IN
    SELECT o.id, o.university_id, o.field_name, o.value_raw, o.value_normalized,
           o.evidence_snippet, o.source_url, o.parser_version, o.status,
           o.entity_type, o.entity_id, o.fact_group
    FROM official_site_observations o
    WHERE o.field_name IN ('min_ielts','min_toefl','duolingo_min','pte_min','cefr_level','language_of_instruction')
      AND o.status = 'verified'
      AND (_university_id IS NULL OR o.university_id = _university_id)
    ORDER BY o.created_at DESC
  LOOP
    v_matched_program_id := NULL;
    v_scope := 'university';
    v_reason := 'general_university_page';

    -- Rule 1: entity_id already points to a program
    IF v_obs.entity_id IS NOT NULL THEN
      SELECT id INTO v_matched_program_id
      FROM programs WHERE id = v_obs.entity_id LIMIT 1;
      IF v_matched_program_id IS NOT NULL THEN
        v_scope := 'program';
        v_reason := 'entity_id_match';
      END IF;
    END IF;

    -- Rule 2: source_url matches a program's source_program_url
    IF v_matched_program_id IS NULL AND v_obs.source_url IS NOT NULL THEN
      SELECT id INTO v_matched_program_id
      FROM programs
      WHERE university_id = v_obs.university_id
        AND source_program_url IS NOT NULL
        AND source_program_url = v_obs.source_url
      LIMIT 1;
      IF v_matched_program_id IS NOT NULL THEN
        v_scope := 'program';
        v_reason := 'source_url_exact_match';
      END IF;
    END IF;

    -- Rule 3: source_url contains program-specific path pattern
    IF v_matched_program_id IS NULL AND v_obs.source_url IS NOT NULL THEN
      IF v_obs.source_url ~ '/courses/[^/]+-(?:bsc|msc|ba|ma|phd|mba|llm|bed|beng|meng|pgce|pgdip|mphil|dphil)(?:/|$)'
         OR v_obs.source_url ~ '/programmes?/[^/]+/(?:entry|admission|requirements|language)'
         OR v_obs.source_url ~ '/study/(?:undergraduate|postgraduate)/[^/]+/(?:entry|requirements)'
      THEN
        SELECT id INTO v_matched_program_id
        FROM programs
        WHERE university_id = v_obs.university_id
          AND source_program_url IS NOT NULL
          AND (
            v_obs.source_url LIKE source_program_url || '%'
            OR source_program_url LIKE regexp_replace(v_obs.source_url, '/(?:entry|admission|requirements|language)[^/]*$', '') || '%'
          )
        LIMIT 1;
        IF v_matched_program_id IS NOT NULL THEN
          v_scope := 'program';
          v_reason := 'url_pattern_match';
        ELSE
          v_scope := 'program_candidate';
          v_reason := 'program_url_pattern_no_catalog_match';
        END IF;
      END IF;
    END IF;

    -- Skip university-scoped observations
    IF v_scope = 'university' THEN
      v_skipped_uni_scope := v_skipped_uni_scope + 1;
      v_results := v_results || jsonb_build_object(
        'obs_id', v_obs.id, 'field', v_obs.field_name, 'value', v_obs.value_raw,
        'scope', v_scope, 'reason', v_reason, 'action', 'kept_as_university_observation'
      );
      CONTINUE;
    END IF;

    -- Skip if no program match found
    IF v_matched_program_id IS NULL THEN
      v_skipped_no_program := v_skipped_no_program + 1;
      v_results := v_results || jsonb_build_object(
        'obs_id', v_obs.id, 'field', v_obs.field_name, 'value', v_obs.value_raw,
        'scope', v_scope, 'reason', v_reason, 'action', 'no_program_to_promote_to'
      );
      CONTINUE;
    END IF;

    -- Promote: update program language fields directly
    IF NOT _dry_run THEN
      IF v_obs.field_name = 'min_ielts' THEN
        UPDATE programs SET ielts_min_overall = v_obs.value_raw::numeric, ielts_required = 1, updated_at = now() WHERE id = v_matched_program_id;
      ELSIF v_obs.field_name = 'min_toefl' THEN
        UPDATE programs SET toefl_min = v_obs.value_raw::numeric, toefl_required = true, updated_at = now() WHERE id = v_matched_program_id;
      ELSIF v_obs.field_name = 'duolingo_min' THEN
        UPDATE programs SET duolingo_min = v_obs.value_raw::numeric, updated_at = now() WHERE id = v_matched_program_id;
      ELSIF v_obs.field_name = 'pte_min' THEN
        UPDATE programs SET pte_min = v_obs.value_raw::numeric, updated_at = now() WHERE id = v_matched_program_id;
      ELSIF v_obs.field_name = 'cefr_level' THEN
        UPDATE programs SET cefr_level = v_obs.value_raw, updated_at = now() WHERE id = v_matched_program_id;
      ELSIF v_obs.field_name = 'language_of_instruction' THEN
        UPDATE programs SET teaching_language = v_obs.value_raw, updated_at = now() WHERE id = v_matched_program_id;
      END IF;
    END IF;

    v_promoted := v_promoted + 1;
    v_results := v_results || jsonb_build_object(
      'obs_id', v_obs.id, 'field', v_obs.field_name, 'value', v_obs.value_raw,
      'scope', v_scope, 'reason', v_reason, 'matched_program_id', v_matched_program_id,
      'action', CASE WHEN _dry_run THEN 'would_promote' ELSE 'promoted' END
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'dry_run', _dry_run,
    'summary', jsonb_build_object(
      'promoted', v_promoted,
      'skipped_university_scope', v_skipped_uni_scope,
      'skipped_no_program', v_skipped_no_program,
      'skipped_duplicate', v_skipped_duplicate,
      'total_processed', v_promoted + v_skipped_uni_scope + v_skipped_no_program + v_skipped_duplicate
    ),
    'details', v_results
  );
END;
$$;
