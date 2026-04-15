ALTER TABLE public.official_site_observations 
  ADD COLUMN IF NOT EXISTS verify_tier text DEFAULT 'auto_verify',
  ADD COLUMN IF NOT EXISTS source_tier text DEFAULT 'live';

COMMENT ON COLUMN public.official_site_observations.verify_tier IS 'Truth-policy tier: auto_verify, verify_only, review_only, never_publish';
COMMENT ON COLUMN public.official_site_observations.source_tier IS 'Acquisition source tier: live, url_variant, google_cache, wayback_machine';