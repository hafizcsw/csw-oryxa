
-- ============================================
-- Phase 1: Fix rpc_publish_program_batch gaps
-- Add missing fields, remove wrong defaults, enforce Null-over-Wrong
-- ============================================

CREATE OR REPLACE FUNCTION rpc_publish_program_batch(
  p_batch_id UUID, 
  p_mode TEXT DEFAULT 'auto_only'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_published INT := 0;
  v_skipped INT := 0;
  v_errors JSONB := '[]'::jsonb;
  r RECORD;
  v_fingerprint TEXT;
  v_program_id UUID;
  v_degree_id UUID;
  v_discipline_id UUID;
  v_languages TEXT[];
  v_evidence RECORD;
  v_study_mode TEXT;
  v_tuition_amount NUMERIC;
  v_intake_months INT[];
  v_toefl_min NUMERIC;
  v_application_fee NUMERIC;
  v_has_scholarship BOOLEAN;
  v_scholarship_type TEXT;
  v_required_documents TEXT[];
  v_description TEXT;
  v_interview_required BOOLEAN;
  v_entrance_exam_required BOOLEAN;
  v_foundation_required BOOLEAN;
BEGIN
  FOR r IN
    SELECT d.*, d.university_id as uni_id
    FROM program_draft d
    WHERE d.batch_id = p_batch_id
      AND d.published_program_id IS NULL
      AND d.university_id IS NOT NULL
      AND (
        (p_mode = 'auto_only' AND d.approval_tier = 'auto')
        OR
        (p_mode = 'auto_plus_quick' AND d.approval_tier IN ('auto','quick'))
      )
  LOOP
    BEGIN
      -- 1. Calculate fingerprint (FIXED: study_mode defaults to NULL, not 'on_campus')
      v_study_mode := r.extracted_json->>'study_mode';  -- NULL if not explicitly set
      v_fingerprint := encode(digest(
        r.uni_id::text || '|' ||
        lower(trim(COALESCE(r.title, ''))) || '|' ||
        COALESCE(r.degree_level, '') || '|' ||
        COALESCE(v_study_mode, '') || '|' ||
        COALESCE(regexp_replace(r.source_program_url, '^https?://[^/]+', ''), '')
      , 'sha256'), 'hex');
      
      -- 2. Map degree_level to degree_id
      SELECT id INTO v_degree_id 
      FROM degrees 
      WHERE slug = lower(COALESCE(r.degree_level, ''))
      LIMIT 1;
      
      -- 3. Get discipline_id from verification_result
      v_discipline_id := NULLIF(r.verification_result->>'discipline_id', '')::uuid;
      
      -- 4. Get primary evidence for tuition
      SELECT * INTO v_evidence
      FROM source_evidence
      WHERE program_draft_id = r.id AND field = 'tuition' AND is_primary = true
      LIMIT 1;
      
      -- 5. Build languages array (FIXED: NULL instead of ARRAY['en'])
      v_languages := CASE 
        WHEN r.language IS NOT NULL THEN ARRAY[r.language]
        WHEN r.extracted_json->'languages' IS NOT NULL 
             AND jsonb_array_length(r.extracted_json->'languages') > 0 THEN 
          ARRAY(SELECT jsonb_array_elements_text(r.extracted_json->'languages'))
        ELSE NULL  -- FIXED: was ARRAY['en'], now NULL (Null-over-Wrong)
      END;
      
      -- 6. Get tuition amount (only if basis and scope are known)
      v_tuition_amount := CASE 
        WHEN v_evidence.tuition_basis IS NOT NULL 
             AND v_evidence.tuition_basis != 'unknown'
             AND v_evidence.tuition_scope IS NOT NULL 
             AND v_evidence.tuition_scope != 'unknown'
        THEN (r.extracted_json->'tuition'->>'amount')::numeric
        ELSE NULL
      END;

      -- 7. Extract NEW fields from extracted_json (previously lost)
      -- intake_months
      v_intake_months := NULL;
      IF r.extracted_json->'intake_months' IS NOT NULL 
         AND jsonb_array_length(r.extracted_json->'intake_months') > 0 THEN
        v_intake_months := ARRAY(
          SELECT (jsonb_array_elements_text(r.extracted_json->'intake_months'))::int
        );
      END IF;

      -- toefl_min
      v_toefl_min := (r.extracted_json->'requirements'->>'toefl')::numeric;

      -- application_fee
      v_application_fee := (r.extracted_json->'application_fee'->>'amount')::numeric;

      -- scholarship
      v_has_scholarship := (r.extracted_json->'scholarship'->>'has_scholarship')::boolean;
      v_scholarship_type := r.extracted_json->'scholarship'->>'type';

      -- required_documents
      v_required_documents := NULL;
      IF r.extracted_json->'requirements'->'documents' IS NOT NULL
         AND jsonb_array_length(r.extracted_json->'requirements'->'documents') > 0 THEN
        v_required_documents := ARRAY(
          SELECT jsonb_array_elements_text(r.extracted_json->'requirements'->'documents')
        );
      END IF;

      -- description
      v_description := r.extracted_json->>'description';

      -- interview/exam/foundation
      v_interview_required := (r.extracted_json->>'interview_required')::boolean;
      v_entrance_exam_required := (r.extracted_json->>'entrance_exam_required')::boolean;
      v_foundation_required := (r.extracted_json->'requirements'->>'foundation_required')::boolean;
      
      -- 8. UPSERT into programs (EXPANDED: 13 new columns)
      INSERT INTO programs (
        university_id, title, degree_id, discipline_id,
        duration_months, study_mode, teaching_language, languages,
        tuition_usd_min, tuition_usd_max, tuition_is_free,
        tuition_basis, tuition_scope, currency_code,
        ielts_min_overall, gpa_min, prep_year_required,
        source_program_url, fingerprint,
        publish_status, is_active,
        -- NEW fields (Phase 1 fix)
        intake_months, toefl_min, application_fee,
        has_scholarship, scholarship_type,
        required_documents, description,
        interview_required, entrance_exam_required, foundation_required
      ) VALUES (
        r.uni_id, r.title, v_degree_id, v_discipline_id,
        r.duration_months, 
        v_study_mode,  -- FIXED: NULL if not explicit (was 'on_campus')
        COALESCE(r.language, v_languages[1]),
        v_languages,   -- FIXED: NULL if not found (was ARRAY['en'])
        v_tuition_amount,
        v_tuition_amount,
        COALESCE((r.extracted_json->'tuition'->>'is_free')::boolean, false),
        v_evidence.tuition_basis, 
        v_evidence.tuition_scope,
        r.currency,
        (r.extracted_json->'requirements'->>'ielts_overall')::numeric,
        (r.extracted_json->'requirements'->>'gpa')::numeric,
        (r.extracted_json->'requirements'->>'prep_year_required')::boolean,
        r.source_program_url, 
        v_fingerprint,
        'published', 
        true,
        -- NEW values
        v_intake_months,
        v_toefl_min,
        v_application_fee,
        v_has_scholarship,
        v_scholarship_type,
        v_required_documents,
        v_description,
        v_interview_required,
        v_entrance_exam_required,
        v_foundation_required
      )
      ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
      DO UPDATE SET
        title = EXCLUDED.title,
        duration_months = EXCLUDED.duration_months,
        study_mode = EXCLUDED.study_mode,
        teaching_language = EXCLUDED.teaching_language,
        languages = EXCLUDED.languages,
        tuition_usd_min = EXCLUDED.tuition_usd_min,
        tuition_usd_max = EXCLUDED.tuition_usd_max,
        tuition_basis = EXCLUDED.tuition_basis,
        tuition_scope = EXCLUDED.tuition_scope,
        -- Update NEW fields on conflict too
        intake_months = EXCLUDED.intake_months,
        toefl_min = EXCLUDED.toefl_min,
        application_fee = EXCLUDED.application_fee,
        has_scholarship = EXCLUDED.has_scholarship,
        scholarship_type = EXCLUDED.scholarship_type,
        required_documents = EXCLUDED.required_documents,
        description = EXCLUDED.description,
        interview_required = EXCLUDED.interview_required,
        entrance_exam_required = EXCLUDED.entrance_exam_required,
        foundation_required = EXCLUDED.foundation_required,
        updated_at = NOW()
      RETURNING id INTO v_program_id;
      
      -- 9. UPSERT program_languages (only if languages are known)
      IF v_languages IS NOT NULL THEN
        INSERT INTO program_languages (program_id, language_code)
        SELECT v_program_id, unnest(v_languages)
        ON CONFLICT DO NOTHING;
      END IF;
      
      -- 10. Update draft
      UPDATE program_draft
      SET fingerprint = v_fingerprint,
          published_program_id = v_program_id,
          status = 'published'
      WHERE id = r.id;
      
      v_published := v_published + 1;
      
    EXCEPTION WHEN others THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object(
        'draft_id', r.id,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Update batch counters
  UPDATE crawl_batches
  SET programs_published = programs_published + v_published,
      status = CASE WHEN v_published > 0 THEN 'done' ELSE status END,
      finished_at = CASE WHEN v_published > 0 THEN NOW() ELSE finished_at END
  WHERE id = p_batch_id;
  
  RETURN jsonb_build_object(
    'published', v_published, 
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

-- Re-secure the function (service_role only)
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.rpc_publish_program_batch(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_publish_program_batch(uuid, text) TO service_role;
