-- Global Crawl Repair v1 (D1-D10)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ingest_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,
  job_id uuid NULL,
  batch_id uuid NULL,
  entity_hint text NOT NULL,
  source_url text NULL,
  fingerprint text NULL,
  stage text NOT NULL,
  reason text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingest_errors_pipeline_created ON public.ingest_errors (pipeline, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_errors_job_id ON public.ingest_errors (job_id);
CREATE INDEX IF NOT EXISTS idx_ingest_errors_batch_id ON public.ingest_errors (batch_id);
CREATE INDEX IF NOT EXISTS idx_ingest_errors_reason ON public.ingest_errors (reason);

ALTER TABLE public.program_draft
  ADD COLUMN IF NOT EXISTS schema_version text NOT NULL DEFAULT 'legacy_v1',
  ADD COLUMN IF NOT EXISTS program_key text NULL,
  ADD COLUMN IF NOT EXISTS content_hash text NULL,
  ADD COLUMN IF NOT EXISTS field_evidence_map jsonb,
  ADD COLUMN IF NOT EXISTS rejection_reasons jsonb,
  ADD COLUMN IF NOT EXISTS last_extracted_at timestamptz NULL;

UPDATE public.program_draft SET extracted_json = '{}'::jsonb WHERE extracted_json IS NULL;
UPDATE public.program_draft SET field_evidence_map = '{}'::jsonb WHERE field_evidence_map IS NULL;
UPDATE public.program_draft SET rejection_reasons = '[]'::jsonb WHERE rejection_reasons IS NULL;

ALTER TABLE public.program_draft
  ALTER COLUMN extracted_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN extracted_json SET NOT NULL,
  ALTER COLUMN field_evidence_map SET DEFAULT '{}'::jsonb,
  ALTER COLUMN field_evidence_map SET NOT NULL,
  ALTER COLUMN rejection_reasons SET DEFAULT '[]'::jsonb,
  ALTER COLUMN rejection_reasons SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_program_draft_program_key ON public.program_draft (program_key) WHERE program_key IS NOT NULL;

CREATE OR REPLACE VIEW public.program_quality_v3 AS
SELECT
  p.university_id,
  COUNT(*) AS total_programs,
  COUNT(*) FILTER (WHERE p.tuition_basis IS NOT NULL) AS tuition_basis_coverage,
  COUNT(*) FILTER (WHERE p.tuition_scope IS NOT NULL) AS tuition_scope_coverage,
  COUNT(*) FILTER (WHERE p.duration_months IS NOT NULL) AS duration_months_coverage,
  COUNT(*) FILTER (WHERE p.tuition_usd_min IS NOT NULL) AS tuition_usd_min_coverage,
  COUNT(*) FILTER (WHERE p.degree_id IS NOT NULL) AS degree_id_coverage,
  COUNT(*) FILTER (WHERE p.discipline_id IS NOT NULL) AS discipline_id_coverage,
  COUNT(*) FILTER (WHERE p.ielts_min_overall IS NOT NULL) AS ielts_coverage,
  COUNT(*) FILTER (WHERE p.toefl_min IS NOT NULL) AS toefl_coverage,
  COUNT(*) FILTER (WHERE p.gpa_min IS NOT NULL) AS gpa_coverage,
  COUNT(*) FILTER (WHERE length(coalesce(p.description, '')) > 100) AS description_coverage,
  COUNT(*) FILTER (WHERE p.scholarship_type IS NOT NULL) AS scholarship_type_coverage,
  COUNT(*) FILTER (
    WHERE p.tuition_basis IS NOT NULL
      AND p.tuition_scope IS NOT NULL
      AND p.duration_months IS NOT NULL
      AND p.tuition_usd_min IS NOT NULL
      AND p.degree_id IS NOT NULL
      AND p.discipline_id IS NOT NULL
      AND (p.ielts_min_overall IS NOT NULL OR p.toefl_min IS NOT NULL)
      AND length(coalesce(p.description, '')) > 100
  ) AS ready_to_publish_count
FROM public.programs p
GROUP BY p.university_id;

CREATE OR REPLACE VIEW public.uniranks_job_health_v1 AS
SELECT
  j.id AS job_id,
  j.created_at,
  coalesce(j.programs_discovered, 0) AS programs_discovered,
  coalesce(j.programs_valid, 0) AS programs_valid,
  coalesce(j.programs_saved, 0) AS programs_saved,
  coalesce(j.programs_rejected, 0) AS programs_rejected,
  (
    SELECT jsonb_object_agg(reason, cnt) FROM (
      SELECT reason, COUNT(*)::int AS cnt
      FROM public.ingest_errors ie
      WHERE ie.pipeline = 'uniranks_enrich' AND ie.job_id = j.id
      GROUP BY reason
      ORDER BY cnt DESC
      LIMIT 10
    ) s
  ) AS top_reasons
FROM public.uniranks_enrich_jobs j;

CREATE OR REPLACE VIEW public.source_health_v1 AS
SELECT
  date_trunc('day', rp.fetched_at) AS day_bucket,
  COUNT(*) AS total_pages,
  COUNT(*) FILTER (WHERE rp.status_code BETWEEN 200 AND 299) AS status_2xx,
  COUNT(*) FILTER (WHERE rp.status_code BETWEEN 400 AND 499) AS status_4xx,
  COUNT(*) FILTER (WHERE rp.status_code >= 500) AS status_5xx,
  AVG(length(coalesce(rp.text_content, '')))::numeric(12,2) AS avg_content_len,
  ROUND(100.0 * COUNT(*) FILTER (WHERE coalesce(rp.fetch_error, '') ILIKE '%blocked%') / NULLIF(COUNT(*), 0), 2) AS blocked_rate_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE coalesce(rp.body_sha256, '') <> '') / NULLIF(COUNT(*), 0), 2) AS checksum_available_pct
FROM public.raw_pages rp
GROUP BY 1
ORDER BY 1 DESC;

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
BEGIN
  FOR r IN
    SELECT d.*
    FROM public.program_draft d
    WHERE d.batch_id = p_batch_id
      AND d.published_program_id IS NULL
      AND (
        (p_mode = 'auto_only' AND d.approval_tier = 'auto')
        OR (p_mode = 'auto_plus_quick' AND d.approval_tier IN ('auto', 'quick'))
        OR d.schema_version = 'unified_v2'
      )
  LOOP
    BEGIN
      SELECT id INTO v_degree_id FROM public.degrees WHERE slug = lower(coalesce(r.extracted_json->'degree'->>'level', r.degree_level, '')) LIMIT 1;
      v_discipline_id := NULLIF(coalesce(r.verification_result->>'discipline_id', r.extracted_json->>'discipline_id', ''), '')::uuid;

      v_tuition_basis := coalesce(r.extracted_json->'tuition'->>'basis', NULL);
      v_tuition_scope := coalesce(r.extracted_json->'tuition'->>'scope', NULL);
      v_ielts := NULLIF(r.extracted_json->'requirements'->>'ielts_min_overall', '')::numeric;
      v_toefl := NULLIF(r.extracted_json->'requirements'->>'toefl_min', '')::numeric;
      v_gpa := NULLIF(r.extracted_json->'requirements'->>'gpa_min', '')::numeric;
      v_description := nullif(r.extracted_json->>'description', '');

      v_missing := ARRAY[]::text[];
      IF (v_tuition_basis IS NOT NULL AND (coalesce(r.field_evidence_map->'tuition.basis'->>'quote', '') = '' OR position(r.field_evidence_map->'tuition.basis'->>'quote' in coalesce(r.extracted_json::text, '')) = 0)) THEN
        v_missing := array_append(v_missing, 'tuition.basis_evidence');
      END IF;
      IF (v_tuition_scope IS NOT NULL AND (coalesce(r.field_evidence_map->'tuition.scope'->>'quote', '') = '' OR position(r.field_evidence_map->'tuition.scope'->>'quote' in coalesce(r.extracted_json::text, '')) = 0)) THEN
        v_missing := array_append(v_missing, 'tuition.scope_evidence');
      END IF;
      IF (v_ielts IS NOT NULL AND (coalesce(r.field_evidence_map->'requirements.ielts_min_overall'->>'quote', '') = '' OR position(r.field_evidence_map->'requirements.ielts_min_overall'->>'quote' in coalesce(r.extracted_json::text, '')) = 0)) THEN
        v_missing := array_append(v_missing, 'ielts_evidence');
      END IF;
      IF (v_gpa IS NOT NULL AND (coalesce(r.field_evidence_map->'requirements.gpa_min'->>'quote', '') = '' OR position(r.field_evidence_map->'requirements.gpa_min'->>'quote' in coalesce(r.extracted_json::text, '')) = 0)) THEN
        v_missing := array_append(v_missing, 'gpa_evidence');
      END IF;

      IF array_length(v_missing, 1) IS NOT NULL THEN
        INSERT INTO public.ingest_errors(pipeline, batch_id, entity_hint, source_url, stage, reason, details)
        VALUES ('crawl_pipeline', p_batch_id, 'program', r.source_program_url, 'publish', 'publish_gate_failed', jsonb_build_object('draft_id', r.id, 'missing_fields', v_missing));
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.programs (
        university_id, title, degree_id, discipline_id,
        duration_months, tuition_usd_min, tuition_usd_max,
        tuition_basis, tuition_scope, ielts_min_overall, toefl_min, gpa_min,
        description, source_program_url, fingerprint, publish_status, is_active
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
        coalesce(r.program_key, r.fingerprint),
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
        updated_at = now()
      RETURNING id INTO v_program_id;

      UPDATE public.program_draft
      SET published_program_id = v_program_id,
          status = 'published'
      WHERE id = r.id;

      v_published := v_published + 1;
    EXCEPTION WHEN others THEN
      INSERT INTO public.ingest_errors(pipeline, batch_id, entity_hint, source_url, stage, reason, details)
      VALUES ('crawl_pipeline', p_batch_id, 'program', r.source_program_url, 'publish', 'db_error', jsonb_build_object('draft_id', r.id, 'error', SQLERRM));
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object('draft_id', r.id, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('published', v_published, 'skipped', v_skipped, 'errors', v_errors);
END;
$$;
