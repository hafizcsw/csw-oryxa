-- Additive ingest error accounting improvements for UniRanks enrich pipeline

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ingest_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,
  job_id uuid NULL,
  batch_id uuid NULL,
  entity_hint text NOT NULL,
  source_url text NULL,
  fingerprint text NULL,
  content_hash text NULL,
  stage text NOT NULL,
  reason text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingest_errors
  ADD COLUMN IF NOT EXISTS content_hash text NULL,
  ADD COLUMN IF NOT EXISTS details jsonb,
  ADD COLUMN IF NOT EXISTS details_json jsonb;

UPDATE public.ingest_errors
SET details_json = COALESCE(details_json, details, '{}'::jsonb)
WHERE details_json IS NULL;

UPDATE public.ingest_errors
SET details = COALESCE(details, details_json, '{}'::jsonb)
WHERE details IS NULL;

ALTER TABLE public.ingest_errors
  ALTER COLUMN details SET DEFAULT '{}'::jsonb,
  ALTER COLUMN details SET NOT NULL,
  ALTER COLUMN details_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN details_json SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ingest_errors_pipeline_job_id ON public.ingest_errors (pipeline, job_id);
CREATE INDEX IF NOT EXISTS idx_ingest_errors_fingerprint ON public.ingest_errors (fingerprint);
CREATE INDEX IF NOT EXISTS idx_ingest_errors_created_at ON public.ingest_errors (created_at DESC);
