
-- Create catalog_ingest_cursor table (was missed due to first migration failure)
CREATE TABLE IF NOT EXISTS public.catalog_ingest_cursor (
  key TEXT PRIMARY KEY,
  page INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  last_run_at TIMESTAMPTZ,
  last_trace_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_ingest_cursor ENABLE ROW LEVEL SECURITY;

-- Add columns to universities if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='universities' AND column_name='uniranks_rank') THEN
    ALTER TABLE public.universities ADD COLUMN uniranks_rank INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='universities' AND column_name='uniranks_score') THEN
    ALTER TABLE public.universities ADD COLUMN uniranks_score NUMERIC;
  END IF;
END $$;

-- Create batchless fetch RPC if not exists
CREATE OR REPLACE FUNCTION public.rpc_lock_program_urls_for_fetch_batchless(
  p_limit INTEGER DEFAULT 10,
  p_locked_by TEXT DEFAULT 'runner'
)
RETURNS SETOF public.program_urls
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE program_urls
  SET locked_at = now(),
      locked_by = p_locked_by,
      lease_expires_at = now() + interval '5 minutes'
  WHERE id IN (
    SELECT id FROM program_urls
    WHERE status = 'pending'
      AND batch_id IS NULL
      AND (lease_expires_at IS NULL OR lease_expires_at < now())
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.rpc_lock_program_urls_for_fetch_batchless FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_lock_program_urls_for_fetch_batchless FROM anon;
REVOKE ALL ON FUNCTION public.rpc_lock_program_urls_for_fetch_batchless FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lock_program_urls_for_fetch_batchless TO service_role;

-- Create batchless publish RPC
CREATE OR REPLACE FUNCTION public.rpc_publish_verified_batchless(
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_published INTEGER := 0;
  v_draft RECORD;
BEGIN
  FOR v_draft IN
    SELECT id, university_id, title, degree_level, language, duration_months,
           tuition_fee, currency, extracted_json, field_evidence_map, source_program_url
    FROM program_draft
    WHERE batch_id IS NULL
      AND status = 'verified'
      AND approval_tier = 'auto'
    ORDER BY created_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO programs (
      university_id, name, degree_level, language,
      duration_months, tuition_fee, currency,
      source_url, published, publish_status
    ) VALUES (
      v_draft.university_id,
      v_draft.title,
      v_draft.degree_level,
      v_draft.language,
      v_draft.duration_months,
      v_draft.tuition_fee,
      v_draft.currency,
      v_draft.source_program_url,
      true,
      'published'
    )
    ON CONFLICT DO NOTHING;

    UPDATE program_draft
    SET status = 'published',
        published_program_id = (
          SELECT id FROM programs
          WHERE university_id = v_draft.university_id
            AND name = v_draft.title
            AND COALESCE(degree_level,'') = COALESCE(v_draft.degree_level,'')
          LIMIT 1
        )
    WHERE id = v_draft.id;

    v_published := v_published + 1;
  END LOOP;

  RETURN jsonb_build_object('published', v_published);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_publish_verified_batchless FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_publish_verified_batchless FROM anon;
REVOKE ALL ON FUNCTION public.rpc_publish_verified_batchless FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_publish_verified_batchless TO service_role;
