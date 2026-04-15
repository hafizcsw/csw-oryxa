-- Add provider_homepage_url_raw column for audit trail
ALTER TABLE public.website_enrichment_rows 
  ADD COLUMN IF NOT EXISTS provider_homepage_url_raw text;

-- Add website_enrichment_job_id to universities for audit
ALTER TABLE public.universities 
  ADD COLUMN IF NOT EXISTS website_enrichment_job_id uuid;

-- Add website_host to universities if not exists (for duplicate domain detection)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'universities' AND column_name = 'website_host') THEN
    ALTER TABLE public.universities ADD COLUMN website_host text;
  END IF;
END $$;

-- Add index for duplicate domain checks
CREATE INDEX IF NOT EXISTS idx_universities_website_host ON public.universities(website_host) WHERE website_host IS NOT NULL;