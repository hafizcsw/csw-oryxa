-- Staging table for discovered QS slugs
CREATE TABLE IF NOT EXISTS public.qs_slug_staging (
  slug TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  match_university_id UUID REFERENCES public.universities(id),
  match_reason TEXT,
  match_confidence NUMERIC(3,2),
  match_status TEXT DEFAULT 'pending'
);

-- Add slug_source to qs_entity_profiles if missing
ALTER TABLE public.qs_entity_profiles 
  ADD COLUMN IF NOT EXISTS slug_source TEXT,
  ADD COLUMN IF NOT EXISTS slug_verified_at TIMESTAMPTZ;

-- Index for matching
CREATE INDEX IF NOT EXISTS idx_qs_slug_staging_status ON public.qs_slug_staging(match_status);
