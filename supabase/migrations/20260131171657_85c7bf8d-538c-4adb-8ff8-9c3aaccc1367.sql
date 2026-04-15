-- Add missing columns to universities table for University Studio
ALTER TABLE public.universities 
ADD COLUMN IF NOT EXISTS name_en TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS seo_h1 TEXT,
ADD COLUMN IF NOT EXISTS seo_canonical_url TEXT,
ADD COLUMN IF NOT EXISTS seo_index BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS seo_last_reviewed_at TIMESTAMPTZ;

-- Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_universities_slug ON public.universities(slug) WHERE slug IS NOT NULL;