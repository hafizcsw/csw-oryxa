-- Add country targeting + completeness to official_site_crawl_jobs
ALTER TABLE public.official_site_crawl_jobs
  ADD COLUMN IF NOT EXISTS country_codes text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_universities integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_pages_per_uni integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS source_policy text DEFAULT 'official_only';

-- Add completeness tracking to official_site_crawl_rows
ALTER TABLE public.official_site_crawl_rows
  ADD COLUMN IF NOT EXISTS country_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completeness_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completeness_by_section jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pages_scraped integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pages_mapped integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discovery_passes jsonb DEFAULT '[]';

-- Add page_title + source_type to observations for full provenance
ALTER TABLE public.official_site_observations
  ADD COLUMN IF NOT EXISTS page_title text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'official_website',
  ADD COLUMN IF NOT EXISTS fact_group text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz DEFAULT now();

-- Index for country-based queries
CREATE INDEX IF NOT EXISTS idx_osc_rows_country ON public.official_site_crawl_rows(country_code);
CREATE INDEX IF NOT EXISTS idx_osc_obs_fact_group ON public.official_site_observations(fact_group);