-- ============================================================
-- GLOBAL SEARCH SOT IMPLEMENTATION - ORDER #4 (FIXED)
-- ============================================================

-- ============================================================
-- PHASE 0: Drop existing view first (required for schema change)
-- ============================================================

DROP VIEW IF EXISTS public.vw_program_search_api CASCADE;

-- ============================================================
-- PHASE 1: Create program_languages join table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.program_languages (
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (program_id, language_code)
);

-- Enforce lowercase ISO639 format for language codes (drop if exists first)
ALTER TABLE public.program_languages
  DROP CONSTRAINT IF EXISTS program_languages_lang_format;

ALTER TABLE public.program_languages
  ADD CONSTRAINT program_languages_lang_format
  CHECK (language_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$');

-- Create index for fast language filtering
CREATE INDEX IF NOT EXISTS idx_program_languages_lang ON public.program_languages(language_code);
CREATE INDEX IF NOT EXISTS idx_program_languages_program ON public.program_languages(program_id);

-- ============================================================
-- PHASE 2: Backfill program_languages from existing data
-- ============================================================

-- Backfill from programs.languages array
INSERT INTO public.program_languages (program_id, language_code)
SELECT 
  p.id,
  LOWER(TRIM(lang)) as language_code
FROM public.programs p,
LATERAL unnest(p.languages) as lang
WHERE p.languages IS NOT NULL
  AND array_length(p.languages, 1) > 0
ON CONFLICT (program_id, language_code) DO NOTHING;

-- Backfill from programs.language column
INSERT INTO public.program_languages (program_id, language_code)
SELECT 
  p.id,
  LOWER(TRIM(p.language)) as language_code
FROM public.programs p
WHERE p.language IS NOT NULL 
  AND TRIM(p.language) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.program_languages pl WHERE pl.program_id = p.id
  )
ON CONFLICT (program_id, language_code) DO NOTHING;

-- Backfill from programs.teaching_language column
INSERT INTO public.program_languages (program_id, language_code)
SELECT 
  p.id,
  LOWER(TRIM(p.teaching_language)) as language_code
FROM public.programs p
WHERE p.teaching_language IS NOT NULL 
  AND TRIM(p.teaching_language) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.program_languages pl WHERE pl.program_id = p.id
  )
ON CONFLICT (program_id, language_code) DO NOTHING;

-- ============================================================
-- PHASE 3: Add publish_status to programs (if not exists)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'programs' 
    AND column_name = 'publish_status'
  ) THEN
    ALTER TABLE public.programs 
    ADD COLUMN publish_status TEXT DEFAULT 'draft';
  END IF;
END $$;

-- Backfill publish_status from existing published boolean
UPDATE public.programs 
SET publish_status = CASE 
  WHEN published = true THEN 'published' 
  ELSE 'draft' 
END
WHERE publish_status IS NULL OR publish_status = 'draft';

-- ============================================================
-- PHASE 4: Add tuition_usd_min/max to programs (if not exists)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'programs' 
    AND column_name = 'tuition_usd_min'
  ) THEN
    ALTER TABLE public.programs 
    ADD COLUMN tuition_usd_min NUMERIC;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'programs' 
    AND column_name = 'tuition_usd_max'
  ) THEN
    ALTER TABLE public.programs 
    ADD COLUMN tuition_usd_max NUMERIC;
  END IF;
END $$;

-- Backfill tuition from existing tuition_yearly
UPDATE public.programs 
SET 
  tuition_usd_min = COALESCE(tuition_usd_min, tuition_yearly),
  tuition_usd_max = COALESCE(tuition_usd_max, tuition_yearly)
WHERE tuition_yearly IS NOT NULL 
  AND (tuition_usd_min IS NULL OR tuition_usd_max IS NULL);

-- ============================================================
-- PHASE 5: Add country_code to countries (optional for future)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'countries' 
    AND column_name = 'country_code'
  ) THEN
    ALTER TABLE public.countries 
    ADD COLUMN country_code TEXT;
  END IF;
END $$;

-- ============================================================
-- PHASE 6: Create normalization trigger for country_code
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_country_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.country_code IS NOT NULL THEN
    NEW.country_code := UPPER(TRIM(NEW.country_code));
  END IF;
  IF NEW.slug IS NOT NULL THEN
    NEW.slug := LOWER(TRIM(NEW.slug));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_normalize_country_code ON public.countries;
CREATE TRIGGER trg_normalize_country_code
BEFORE INSERT OR UPDATE ON public.countries
FOR EACH ROW EXECUTE FUNCTION public.normalize_country_code();

-- ============================================================
-- PHASE 7: Create the UNIFIED API View (SoT)
-- ============================================================

CREATE OR REPLACE VIEW public.vw_program_search_api AS
SELECT
  p.id AS program_id,
  p.title AS program_name_ar,
  p.title AS program_name_en,
  p.description,
  u.id AS university_id,
  u.name AS university_name_ar,
  u.name AS university_name_en,
  u.logo_url AS university_logo,
  COALESCE(p.city, u.city) AS city,
  c.id AS country_id,
  UPPER(c.slug) AS country_code,
  c.name_ar AS country_name_ar,
  c.name_en AS country_name_en,
  d.id AS degree_id,
  d.slug AS degree_slug,
  d.name AS degree_name,
  (
    SELECT ARRAY_AGG(pl.language_code ORDER BY pl.language_code)
    FROM public.program_languages pl
    WHERE pl.program_id = p.id
  ) AS languages,
  COALESCE(
    (SELECT pl.language_code FROM public.program_languages pl WHERE pl.program_id = p.id ORDER BY pl.language_code LIMIT 1),
    LOWER(TRIM(p.language)),
    LOWER(TRIM(p.teaching_language)),
    'en'
  ) AS language,
  COALESCE(p.tuition_usd_min, p.tuition_yearly) AS tuition_usd_min,
  COALESCE(p.tuition_usd_max, p.tuition_yearly) AS tuition_usd_max,
  p.currency_code,
  u.monthly_living,
  p.duration_months,
  u.ranking,
  COALESCE(p.is_active, true) AS is_active,
  COALESCE(p.publish_status, 'draft') AS publish_status,
  CONCAT('/programs/', LOWER(c.slug), '/', p.id::TEXT) AS portal_url
FROM public.programs p
JOIN public.universities u ON u.id = p.university_id
JOIN public.countries c ON c.id = u.country_id
LEFT JOIN public.degrees d ON d.id = p.degree_id;

-- ============================================================
-- PHASE 8: Create indexes for fast filtering
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_programs_university ON public.programs(university_id);
CREATE INDEX IF NOT EXISTS idx_programs_degree ON public.programs(degree_id);
CREATE INDEX IF NOT EXISTS idx_programs_tuition_min ON public.programs(tuition_usd_min);
CREATE INDEX IF NOT EXISTS idx_programs_tuition_max ON public.programs(tuition_usd_max);
CREATE INDEX IF NOT EXISTS idx_programs_active ON public.programs(is_active);
CREATE INDEX IF NOT EXISTS idx_programs_publish_status ON public.programs(publish_status);
CREATE INDEX IF NOT EXISTS idx_universities_country ON public.universities(country_id);

-- ============================================================
-- PHASE 9: Create publish gate trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_program_publish_requirements()
RETURNS TRIGGER AS $$
DECLARE
  lang_count INT;
BEGIN
  IF NEW.publish_status = 'published' THEN
    IF NEW.university_id IS NULL THEN
      RAISE EXCEPTION 'Cannot publish: missing university_id';
    END IF;
    
    IF NEW.duration_months IS NULL THEN
      RAISE EXCEPTION 'Cannot publish: missing duration_months';
    END IF;
    
    IF COALESCE(NEW.tuition_usd_min, NEW.tuition_yearly) IS NULL 
       AND COALESCE(NEW.tuition_usd_max, NEW.tuition_yearly) IS NULL THEN
      RAISE EXCEPTION 'Cannot publish: missing tuition information';
    END IF;
    
    IF NEW.is_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Cannot publish: program must be active';
    END IF;

    SELECT COUNT(*) INTO lang_count
    FROM public.program_languages
    WHERE program_id = NEW.id;

    IF lang_count = 0 
       AND (NEW.language IS NULL OR TRIM(NEW.language) = '')
       AND (NEW.teaching_language IS NULL OR TRIM(NEW.teaching_language) = '') THEN
      RAISE EXCEPTION 'Cannot publish: no languages set';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_program_publish_gate ON public.programs;
CREATE TRIGGER trg_program_publish_gate
BEFORE INSERT OR UPDATE ON public.programs
FOR EACH ROW EXECUTE FUNCTION public.enforce_program_publish_requirements();

-- ============================================================
-- PHASE 10: Enable RLS on program_languages
-- ============================================================

ALTER TABLE public.program_languages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read program_languages" ON public.program_languages;
CREATE POLICY "Anyone can read program_languages"
ON public.program_languages
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can modify program_languages" ON public.program_languages;
CREATE POLICY "Admins can modify program_languages"
ON public.program_languages
FOR ALL
USING (public.check_is_admin(auth.uid()))
WITH CHECK (public.check_is_admin(auth.uid()));