
-- 1. Add fetched_at and parser_version to observations table
ALTER TABLE public.official_site_observations 
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parser_version TEXT;

-- 2. Add published_partial to crawl_status check constraint
ALTER TABLE public.official_site_crawl_rows 
  DROP CONSTRAINT IF EXISTS official_site_crawl_rows_crawl_status_check;

ALTER TABLE public.official_site_crawl_rows 
  ADD CONSTRAINT official_site_crawl_rows_crawl_status_check 
  CHECK (crawl_status IN ('queued','planning','fetching','extracting','verifying','verified','published','published_partial','quarantined','special','failed'));
