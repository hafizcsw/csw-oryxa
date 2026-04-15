ALTER TABLE public.uniranks_enrich_jobs
  ADD COLUMN IF NOT EXISTS programs_discovered INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS programs_valid INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS programs_rejected INTEGER DEFAULT 0;