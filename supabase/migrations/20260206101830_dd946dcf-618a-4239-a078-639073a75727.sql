-- Create table to track crawl jobs
CREATE TABLE IF NOT EXISTS public.uniranks_crawl_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  current_page integer NOT NULL DEFAULT 0,
  max_pages integer NOT NULL DEFAULT 50,
  total_found integer NOT NULL DEFAULT 0,
  total_imported integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.uniranks_crawl_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated admins to manage jobs
CREATE POLICY "Admins can manage crawl jobs" ON public.uniranks_crawl_jobs
FOR ALL USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Index for status lookups
CREATE INDEX IF NOT EXISTS idx_uniranks_crawl_jobs_status ON public.uniranks_crawl_jobs(status);