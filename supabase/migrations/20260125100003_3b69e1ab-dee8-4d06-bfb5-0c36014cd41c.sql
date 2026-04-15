-- =====================================================
-- ORDER #4 FIX: Global Tuition/Currency Normalization
-- =====================================================

-- 1) Add local tuition fields + free flag
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS tuition_local_min numeric,
  ADD COLUMN IF NOT EXISTS tuition_local_max numeric,
  ADD COLUMN IF NOT EXISTS tuition_is_free boolean DEFAULT false;

-- 2) Normalize currency_code to uppercase
UPDATE public.programs
SET currency_code = upper(trim(currency_code))
WHERE currency_code IS NOT NULL;

-- 3) Move WRONG non-USD amounts from tuition_usd_* into local fields (preserve data!)
UPDATE public.programs
SET
  tuition_local_min = COALESCE(tuition_local_min, tuition_usd_min),
  tuition_local_max = COALESCE(tuition_local_max, tuition_usd_max)
WHERE COALESCE(upper(currency_code), 'USD') <> 'USD'
  AND (tuition_usd_min IS NOT NULL OR tuition_usd_max IS NOT NULL);

-- 4) Null out tuition_usd_* for non-USD to force FX calculation in view
UPDATE public.programs
SET tuition_usd_min = NULL,
    tuition_usd_max = NULL
WHERE COALESCE(upper(currency_code), 'USD') <> 'USD'
  AND (tuition_usd_min IS NOT NULL OR tuition_usd_max IS NOT NULL);

-- 5) For USD programs, backfill local from USD
UPDATE public.programs
SET
  tuition_local_min = COALESCE(tuition_local_min, tuition_usd_min),
  tuition_local_max = COALESCE(tuition_local_max, tuition_usd_max)
WHERE COALESCE(upper(currency_code), 'USD') = 'USD';

-- 6) Mark free programs (tuition = 0 or null everywhere)
UPDATE public.programs
SET tuition_is_free = true
WHERE COALESCE(tuition_yearly, 0) = 0
  AND COALESCE(tuition_usd_min, 0) = 0
  AND COALESCE(tuition_usd_max, 0) = 0
  AND tuition_local_min IS NULL
  AND tuition_local_max IS NULL
  AND is_active = true;

-- =====================================================
-- 7) Recreate vw_program_search_api with proper FX logic
-- Using actual column names from schema
-- =====================================================
DROP VIEW IF EXISTS public.vw_program_search_api;

CREATE VIEW public.vw_program_search_api AS
SELECT
  p.id AS program_id,
  p.title AS program_name_ar,
  p.title AS program_name_en,
  p.description,
  p.university_id,
  u.name AS university_name_ar,
  u.name AS university_name_en,
  u.logo_url AS university_logo,
  c.id AS country_id,
  c.country_code,
  c.name_ar AS country_name_ar,
  c.name_en AS country_name_en,
  u.city,
  COALESCE(p.degree_level, d.slug) AS degree_slug,
  d.name AS degree_name,
  -- Primary language
  COALESCE(
    p.teaching_language,
    p.language,
    (SELECT pl.language_code FROM program_languages pl WHERE pl.program_id = p.id LIMIT 1)
  ) AS language,
  -- Languages array
  COALESCE(
    (SELECT array_agg(DISTINCT pl.language_code) FROM program_languages pl WHERE pl.program_id = p.id),
    CASE WHEN p.teaching_language IS NOT NULL THEN ARRAY[p.teaching_language]
         WHEN p.language IS NOT NULL THEN ARRAY[p.language]
         ELSE NULL END
  ) AS languages,
  -- =====================================================
  -- TUITION USD CALCULATION (SoT = local + FX)
  -- =====================================================
  CASE
    WHEN COALESCE(p.tuition_is_free, false) = true THEN 0
    WHEN COALESCE(upper(p.currency_code), 'USD') = 'USD' THEN 
      COALESCE(p.tuition_usd_min, p.tuition_local_min, p.tuition_yearly)
    ELSE 
      ROUND(COALESCE(p.tuition_local_min, p.tuition_yearly, 0) * COALESCE(fx.rate_to_usd, 1), 2)
  END AS tuition_usd_min,
  CASE
    WHEN COALESCE(p.tuition_is_free, false) = true THEN 0
    WHEN COALESCE(upper(p.currency_code), 'USD') = 'USD' THEN 
      COALESCE(p.tuition_usd_max, p.tuition_local_max, p.tuition_yearly)
    ELSE 
      ROUND(COALESCE(p.tuition_local_max, p.tuition_yearly, 0) * COALESCE(fx.rate_to_usd, 1), 2)
  END AS tuition_usd_max,
  -- Local tuition passthrough
  p.currency_code,
  COALESCE(p.tuition_local_max, p.tuition_yearly) AS tuition_local_amount,
  p.tuition_is_free,
  -- Other fields
  u.ranking,
  p.duration_months,
  '/programs/' || p.program_slug AS portal_url,
  p.is_active,
  p.publish_status
FROM programs p
JOIN universities u ON u.id = p.university_id
JOIN countries c ON c.id = u.country_id
LEFT JOIN degrees d ON d.id = p.degree_id
LEFT JOIN fx_rates fx ON fx.currency_code = upper(p.currency_code);

-- =====================================================
-- 8) Update Publish Gate Trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.enforce_program_publish_requirements()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  lang_count INT;
  has_fx BOOLEAN;
BEGIN
  IF NEW.publish_status = 'published' AND 
     (OLD IS NULL OR OLD.publish_status IS DISTINCT FROM 'published') THEN
    
    -- Must have university
    IF NEW.university_id IS NULL THEN
      RAISE EXCEPTION 'Cannot publish: missing university_id';
    END IF;
    
    -- Must have duration
    IF NEW.duration_months IS NULL THEN
      RAISE EXCEPTION 'Cannot publish: missing duration_months';
    END IF;
    
    -- Must have tuition OR be free
    IF COALESCE(NEW.tuition_is_free, false) = false THEN
      IF COALESCE(NEW.tuition_local_min, NEW.tuition_local_max, NEW.tuition_yearly, NEW.tuition_usd_min, NEW.tuition_usd_max) IS NULL THEN
        RAISE EXCEPTION 'Cannot publish: missing tuition information (set tuition_is_free=true for free programs)';
      END IF;
    END IF;
    
    -- Must be active
    IF NEW.is_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Cannot publish: program must be active';
    END IF;

    -- Must have languages
    SELECT COUNT(*) INTO lang_count
    FROM public.program_languages
    WHERE program_id = NEW.id;

    IF lang_count = 0 
       AND (NEW.language IS NULL OR TRIM(NEW.language) = '')
       AND (NEW.teaching_language IS NULL OR TRIM(NEW.teaching_language) = '') THEN
      RAISE EXCEPTION 'Cannot publish: no languages set';
    END IF;
    
    -- Non-USD programs must have FX rate
    IF COALESCE(upper(NEW.currency_code), 'USD') <> 'USD' THEN
      SELECT EXISTS(
        SELECT 1 FROM fx_rates WHERE currency_code = upper(NEW.currency_code)
      ) INTO has_fx;
      
      IF NOT has_fx THEN
        RAISE EXCEPTION 'Cannot publish: no FX rate for currency %', NEW.currency_code;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;