ALTER TABLE public.uniranks_enrich_jobs
  ADD COLUMN IF NOT EXISTS programs_discovered integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS programs_valid integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS programs_rejected integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reasons jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.uniranks_enrich_jobs
SET
  programs_discovered = COALESCE(programs_discovered, programs_found, 0),
  programs_valid = COALESCE(programs_valid, enriched, 0),
  programs_rejected = COALESCE(programs_rejected, errors, 0),
  updated_at = COALESCE(updated_at, last_activity_at, completed_at, started_at, created_at);
