-- Create table to track enrichment jobs
CREATE TABLE IF NOT EXISTS public.uniranks_enrich_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'staging',
  total_universities INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  enriched INTEGER NOT NULL DEFAULT 0,
  programs_found INTEGER NOT NULL DEFAULT 0,
  programs_saved INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.uniranks_enrich_jobs ENABLE ROW LEVEL SECURITY;

-- Allow admin access (service role only)
CREATE POLICY "Service role can manage enrich jobs"
ON public.uniranks_enrich_jobs
FOR ALL
USING (true)
WITH CHECK (true);

-- Add status column to staging table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'university_import_staging' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.university_import_staging ADD COLUMN status TEXT;
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staging_status ON public.university_import_staging(status) WHERE source = 'uniranks';