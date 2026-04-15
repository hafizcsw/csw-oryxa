-- Add last_activity_at column for better tracking of stuck jobs
ALTER TABLE public.uniranks_crawl_jobs 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- Add index for finding paused/stuck jobs
CREATE INDEX IF NOT EXISTS idx_uniranks_jobs_status_activity 
ON public.uniranks_crawl_jobs (status, last_activity_at DESC);
