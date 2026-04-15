-- Follow-up stability fixes:
-- 1) avoid non-additive strict NOT NULL rollout on program_draft JSON audit columns
-- 2) resolve publish upsert conflicts on programs.program_key

-- Keep columns nullable for backward compatibility with legacy writers
ALTER TABLE public.program_draft
  ALTER COLUMN extracted_json DROP NOT NULL,
  ALTER COLUMN field_evidence_map DROP NOT NULL,
  ALTER COLUMN rejection_reasons DROP NOT NULL;

-- Recreate publish RPC with program_key-aware conflict handling
CREATE OR REPLACE FUNCTION public.rpc_publish_program_batch(
  p_batch_id uuid,
  p_mode text DEFAULT 'auto_only'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
  v_program_id uuid;
  v_degree_id uuid;
  v_discipline_id uuid;
  v_published int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_tuition_basis text;
  v_tuition_scope text;
  v_ielts numeric;
  v_toefl numeric;
  v_gpa numeric;
  v_description text;
  v_missing text[];
  v_page_text text;
  v_fingerprint text;
BEGIN
  FOR r IN
    SELECT d.*
    FROM public.program_draft d
    WHERE d.batch_id = p_batch_id
      AND d.university_id IS NOT NULL
      AND (d.published_program_id IS NULL OR d.published_program_id::text = '')
      AND (
        (p_mode = 'auto_only' AND d.approval_tier = 'auto')
        OR (p_mode = 'auto_plus_quick' AND d.approval_tier IN ('auto', 'quick'))
        OR d.schema_version = 'unified_v2'
      )
  LOOP
    BEGIN
      SELECT id INTO v_degree_id
      FROM public.degrees
      WHERE slug = lower(coalesce(r.extracted_json->'degree'->>'level', r.degree_level, ''))
      LIMIT 1;

      v_discipline_id := NULLIF(coalesce(r.verification_result->>'discipline_id', r.extracted_json->>'discipline_id', ''), '')::uuid;

      v_tuition_basis := NULLIF(r.extracted_json->'tuition'->>'basis', '');
      v_tuition_scope := NULLIF(r.extracted_json->'tuition'->>'scope', '');
      v_ielts := NULLIF(r.extracted_json->'requirements'->>'ielts_min_overall', '')::numeric;
      v_toefl := NULLIF(r.extracted_json->'requirements'->>'toefl_min', '')::numeric;
      v_gpa := NULLIF(r.extracted_json->'requirements'->>'gpa_min', '')::numeric;
      v_description := nullif(r.extracted_json->>'description', '');

      SELECT rp.text_content INTO v_page_text
      FROM public.raw_pages rp
      WHERE rp.id = r.raw_page_id
         OR rp.url = coalesce(r.source_program_url, r.source_url)
      ORDER BY CASE WHEN rp.id = r.raw_page_id THEN 0 ELSE 1 END
      LIMIT 1;

      v_missing := ARRAY[]::text[];
      IF (v_tuition_basis IS NOT NULL AND (coalesce(r.field_evidence_map->'tuition.basis'->>'quote', '') = '' OR position(r.field_evidence_map->'tuition.basis'->>'quote' in coalesce(v_page_text, '')) = 0)) THEN
        v_missing := array_append(v_missing, 'tuition.basis_evidence');
      END IF;
      IF (v_tuition_scope IS NOT NULL AND (coalesce(r.field_evidence_map->'tuition.scope'->>'quote', '') = '' OR position(r.field_evidence_map->'tuition.scope'->>'quote' in coalesce(v_page_text, '')) = 0)) THEN
        v_missing := array_append(v_missing, 'tuition.scope_evidence');
      END IF;
      IF (v_ielts IS NOT NULL AND (coalesce(r.field_evidence_map->'requirements.ielts_min_overall'->>'quote', '') = '' OR position(r.field_evidence_map->'requirements.ielts_min_overall'->>'quote' in coalesce(v_page_text, '')) = 0)) THEN
        v_missing := array_append(v_missing, 'ielts_evidence');
      END IF;
      IF (v_gpa IS NOT NULL AND (coalesce(r.field_evidence_map->'requirements.gpa_min'->>'quote', '') = '' OR position(r.field_evidence_map->'requirements.gpa_min'->>'quote' in coalesce(v_page_text, '')) = 0)) THEN
        v_missing := array_append(v_missing, 'gpa_evidence');
      END IF;

      IF array_length(v_missing, 1) IS NOT NULL THEN
        INSERT INTO public.ingest_errors(pipeline, batch_id, entity_hint, source_url, stage, reason, details)
        VALUES ('crawl_pipeline', p_batch_id, 'program', coalesce(r.source_program_url, r.source_url), 'publish', 'publish_gate_failed', jsonb_build_object('draft_id', r.id, 'missing_fields', v_missing));
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_fingerprint := substring(coalesce(r.program_key, r.fingerprint, encode(digest(coalesce(r.title, ''), 'sha256'), 'hex')) for 32);

      IF r.program_key IS NOT NULL THEN
        INSERT INTO public.programs (
          university_id, title, degree_id, discipline_id,
          duration_months, tuition_usd_min, tuition_usd_max,
          tuition_basis, tuition_scope, ielts_min_overall, toefl_min, gpa_min,
          description, source_program_url, fingerprint, program_key, publish_status, is_active
        ) VALUES (
          r.university_id,
          coalesce(r.extracted_json->>'name', r.title),
          v_degree_id,
          v_discipline_id,
          coalesce(NULLIF(r.extracted_json->'duration'->>'months', '')::int, r.duration_months),
          NULLIF(r.extracted_json->'tuition'->>'usd_min', '')::numeric,
          NULLIF(r.extracted_json->'tuition'->>'usd_max', '')::numeric,
          v_tuition_basis,
          v_tuition_scope,
          v_ielts,
          v_toefl,
          v_gpa,
          v_description,
          coalesce(r.source_program_url, r.source_url),
          v_fingerprint,
          r.program_key,
          'published',
          true
        )
        ON CONFLICT (program_key) WHERE program_key IS NOT NULL
        DO UPDATE SET
          title = EXCLUDED.title,
          tuition_basis = EXCLUDED.tuition_basis,
          tuition_scope = EXCLUDED.tuition_scope,
          ielts_min_overall = EXCLUDED.ielts_min_overall,
          toefl_min = EXCLUDED.toefl_min,
          gpa_min = EXCLUDED.gpa_min,
          description = EXCLUDED.description,
          fingerprint = EXCLUDED.fingerprint,
          updated_at = now()
        RETURNING id INTO v_program_id;
      ELSE
        INSERT INTO public.programs (
          university_id, title, degree_id, discipline_id,
          duration_months, tuition_usd_min, tuition_usd_max,
          tuition_basis, tuition_scope, ielts_min_overall, toefl_min, gpa_min,
          description, source_program_url, fingerprint, program_key, publish_status, is_active
        ) VALUES (
          r.university_id,
          coalesce(r.extracted_json->>'name', r.title),
          v_degree_id,
          v_discipline_id,
          coalesce(NULLIF(r.extracted_json->'duration'->>'months', '')::int, r.duration_months),
          NULLIF(r.extracted_json->'tuition'->>'usd_min', '')::numeric,
          NULLIF(r.extracted_json->'tuition'->>'usd_max', '')::numeric,
          v_tuition_basis,
          v_tuition_scope,
          v_ielts,
          v_toefl,
          v_gpa,
          v_description,
          coalesce(r.source_program_url, r.source_url),
          v_fingerprint,
          r.program_key,
          'published',
          true
        )
        ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL
        DO UPDATE SET
          title = EXCLUDED.title,
          tuition_basis = EXCLUDED.tuition_basis,
          tuition_scope = EXCLUDED.tuition_scope,
          ielts_min_overall = EXCLUDED.ielts_min_overall,
          toefl_min = EXCLUDED.toefl_min,
          gpa_min = EXCLUDED.gpa_min,
          description = EXCLUDED.description,
          program_key = EXCLUDED.program_key,
          updated_at = now()
        RETURNING id INTO v_program_id;
      END IF;

      UPDATE public.program_draft
      SET published_program_id = v_program_id,
          status = 'published'
      WHERE id = r.id;

      v_published := v_published + 1;
    EXCEPTION WHEN others THEN
      INSERT INTO public.ingest_errors(pipeline, batch_id, entity_hint, source_url, stage, reason, details)
      VALUES ('crawl_pipeline', p_batch_id, 'program', coalesce(r.source_program_url, r.source_url), 'publish', 'db_error', jsonb_build_object('draft_id', r.id, 'error', SQLERRM));
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object('draft_id', r.id, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('published', v_published, 'skipped', v_skipped, 'errors', v_errors);
END;
$$;

-- Preserve SECURITY DEFINER hardening after function replacement
ALTER FUNCTION public.rpc_publish_program_batch(uuid, text)
  SET search_path = public, pg_temp;
