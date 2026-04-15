
-- Add retry tracking columns for Direct Lane partial quarantine
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS uniranks_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS uniranks_next_retry_at timestamptz;

-- Index for efficient selection query (exclude backoff + quarantined)
CREATE INDEX IF NOT EXISTS idx_universities_uniranks_retry
  ON public.universities (crawl_status, uniranks_next_retry_at)
  WHERE crawl_status NOT IN ('uniranks_done', 'uniranks_no_programs', 'uniranks_partial_done');
