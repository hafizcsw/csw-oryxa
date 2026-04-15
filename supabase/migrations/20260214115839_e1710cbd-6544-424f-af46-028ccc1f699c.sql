
-- ============================================================
-- FIX: Apply table changes that were in the failed first migration
-- ============================================================

-- 1) ingest_errors table
CREATE TABLE IF NOT EXISTS public.ingest_errors (
  id BIGSERIAL PRIMARY KEY,
  pipeline TEXT NOT NULL,
  job_id TEXT,
  batch_id UUID,
  entity_hint TEXT,
  source_url TEXT,
  fingerprint TEXT,
  content_hash TEXT,
  stage TEXT NOT NULL,
  reason TEXT NOT NULL,
  details_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ingest_errors_stage_reason ON public.ingest_errors (stage, reason, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_errors_batch ON public.ingest_errors (batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_errors_source ON public.ingest_errors (source_url);
ALTER TABLE public.ingest_errors ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "ingest_errors_admin_read" ON public.ingest_errors FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "ingest_errors_service_write" ON public.ingest_errors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) program_draft: add missing columns
ALTER TABLE public.program_draft
  ADD COLUMN IF NOT EXISTS program_key TEXT,
  ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT 'unified_v2',
  ADD COLUMN IF NOT EXISTS field_evidence_map JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rejection_reasons TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_extracted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extractor_version TEXT;

-- 3) Drop content_hash UNIQUE constraint
ALTER TABLE public.program_draft DROP CONSTRAINT IF EXISTS program_draft_content_hash_key;

-- 4) Drop old fingerprint indexes
DROP INDEX IF EXISTS public.uq_draft_uni_url;
DROP INDEX IF EXISTS public.idx_program_draft_fingerprint;
DROP INDEX IF EXISTS public.idx_program_draft_fingerprint_university;

-- 5) Add program_key UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS uq_program_draft_program_key ON public.program_draft (program_key);

-- 6) crawl_batches: add country_code
ALTER TABLE public.crawl_batches ADD COLUMN IF NOT EXISTS country_code TEXT;

-- 7) program_urls: add leasing columns
ALTER TABLE public.program_urls
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0;

-- 8) program_urls: expand kind CHECK
ALTER TABLE public.program_urls DROP CONSTRAINT IF EXISTS program_urls_kind_check;
ALTER TABLE public.program_urls ADD CONSTRAINT program_urls_kind_check
  CHECK (kind IN ('program','fees','admissions','catalog','scholarships','housing','media','unknown'));

-- 9) program_urls: change UNIQUE to include kind
ALTER TABLE public.program_urls DROP CONSTRAINT IF EXISTS program_urls_university_id_canonical_url_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_program_urls_uni_kind_canonical
  ON public.program_urls (university_id, kind, canonical_url);

CREATE INDEX IF NOT EXISTS idx_program_urls_lease ON public.program_urls (lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_program_urls_status_retry ON public.program_urls (status, retry_at);
