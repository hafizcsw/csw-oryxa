
-- ============================================================
-- GLOBAL SEARCH SOT FIX - ORDER #4.1 (Corrected Schema)
-- ISO2 + Languages + View + FX-Ready Tuition
-- ============================================================

-- Drop blocking trigger first
DROP TRIGGER IF EXISTS trg_program_publish_gate ON public.programs;
DROP FUNCTION IF EXISTS public.enforce_program_publish_requirements() CASCADE;

-- ============================================================
-- PART 1: ISO2 Country Codes
-- ============================================================

UPDATE public.countries SET country_code = CASE slug
  WHEN 'ca' THEN 'CA'
  WHEN 'uk' THEN 'GB'
  WHEN 'cn' THEN 'CN'
  WHEN 'tr' THEN 'TR'
  WHEN 'germany' THEN 'DE'
  WHEN 'spain' THEN 'ES'
  WHEN 'netherlands' THEN 'NL'
  WHEN 'russia' THEN 'RU'
  WHEN 'au' THEN 'AU'
  WHEN 'usa' THEN 'US'
  WHEN 'france' THEN 'FR'
  WHEN 'italy' THEN 'IT'
  WHEN 'japan' THEN 'JP'
  WHEN 'south-korea' THEN 'KR'
  WHEN 'poland' THEN 'PL'
  WHEN 'czech' THEN 'CZ'
  WHEN 'hungary' THEN 'HU'
  WHEN 'austria' THEN 'AT'
  WHEN 'sweden' THEN 'SE'
  WHEN 'denmark' THEN 'DK'
  WHEN 'norway' THEN 'NO'
  WHEN 'finland' THEN 'FI'
  WHEN 'ireland' THEN 'IE'
  WHEN 'portugal' THEN 'PT'
  WHEN 'greece' THEN 'GR'
  WHEN 'belgium' THEN 'BE'
  WHEN 'switzerland' THEN 'CH'
  WHEN 'malaysia' THEN 'MY'
  WHEN 'singapore' THEN 'SG'
  WHEN 'india' THEN 'IN'
  WHEN 'egypt' THEN 'EG'
  WHEN 'uae' THEN 'AE'
  WHEN 'saudi' THEN 'SA'
  WHEN 'jordan' THEN 'JO'
  WHEN 'morocco' THEN 'MA'
  WHEN 'new-zealand' THEN 'NZ'
  WHEN 'brazil' THEN 'BR'
  WHEN 'mexico' THEN 'MX'
  WHEN 'argentina' THEN 'AR'
  WHEN 'chile' THEN 'CL'
  WHEN 'south-africa' THEN 'ZA'
  WHEN 'nigeria' THEN 'NG'
  WHEN 'kenya' THEN 'KE'
  WHEN 'ukraine' THEN 'UA'
  WHEN 'cyprus' THEN 'CY'
  WHEN 'georgia' THEN 'GE'
  WHEN 'azerbaijan' THEN 'AZ'
  WHEN 'kazakhstan' THEN 'KZ'
  WHEN 'uzbekistan' THEN 'UZ'
  WHEN 'thailand' THEN 'TH'
  WHEN 'vietnam' THEN 'VN'
  WHEN 'indonesia' THEN 'ID'
  WHEN 'philippines' THEN 'PH'
  WHEN 'taiwan' THEN 'TW'
  WHEN 'hong-kong' THEN 'HK'
  ELSE UPPER(LEFT(slug, 2))
END
WHERE country_code IS NULL OR country_code = '';

ALTER TABLE public.countries DROP CONSTRAINT IF EXISTS countries_iso2_format;
ALTER TABLE public.countries ADD CONSTRAINT countries_iso2_format CHECK (country_code ~ '^[A-Z]{2}$');
ALTER TABLE public.countries ALTER COLUMN country_code SET NOT NULL;

-- ============================================================
-- PART 2: Languages Reference Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.languages (
  code TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.languages (code, name_en, name_ar) VALUES
  ('en', 'English', 'الإنجليزية'),
  ('ar', 'Arabic', 'العربية'),
  ('ru', 'Russian', 'الروسية'),
  ('de', 'German', 'الألمانية'),
  ('fr', 'French', 'الفرنسية'),
  ('es', 'Spanish', 'الإسبانية'),
  ('it', 'Italian', 'الإيطالية'),
  ('pt', 'Portuguese', 'البرتغالية'),
  ('zh', 'Chinese', 'الصينية'),
  ('ja', 'Japanese', 'اليابانية'),
  ('ko', 'Korean', 'الكورية'),
  ('tr', 'Turkish', 'التركية'),
  ('pl', 'Polish', 'البولندية'),
  ('nl', 'Dutch', 'الهولندية'),
  ('sv', 'Swedish', 'السويدية'),
  ('cs', 'Czech', 'التشيكية'),
  ('hu', 'Hungarian', 'المجرية'),
  ('uk', 'Ukrainian', 'الأوكرانية'),
  ('el', 'Greek', 'اليونانية'),
  ('he', 'Hebrew', 'العبرية'),
  ('th', 'Thai', 'التايلاندية'),
  ('vi', 'Vietnamese', 'الفيتنامية'),
  ('id', 'Indonesian', 'الإندونيسية'),
  ('ms', 'Malay', 'الماليزية'),
  ('hi', 'Hindi', 'الهندية')
ON CONFLICT (code) DO NOTHING;

-- Add missing languages from existing data
INSERT INTO public.languages (code, name_en, name_ar)
SELECT DISTINCT pl.language_code, pl.language_code, pl.language_code
FROM public.program_languages pl
WHERE NOT EXISTS (SELECT 1 FROM public.languages l WHERE l.code = pl.language_code)
ON CONFLICT (code) DO NOTHING;

-- FK constraint
ALTER TABLE public.program_languages DROP CONSTRAINT IF EXISTS program_languages_language_fk;
ALTER TABLE public.program_languages ADD CONSTRAINT program_languages_language_fk 
  FOREIGN KEY (language_code) REFERENCES public.languages(code);

-- RLS
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Languages are publicly readable" ON public.languages;
CREATE POLICY "Languages are publicly readable" ON public.languages FOR SELECT USING (true);

-- ============================================================
-- PART 3: FX Rates Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fx_rates (
  currency_code TEXT PRIMARY KEY,
  rate_to_usd NUMERIC(12,6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.fx_rates (currency_code, rate_to_usd) VALUES
  ('USD', 1.0),
  ('EUR', 1.08),
  ('GBP', 1.27),
  ('CAD', 0.74),
  ('AUD', 0.65),
  ('JPY', 0.0067),
  ('KRW', 0.00074),
  ('SGD', 0.74),
  ('CNY', 0.14),
  ('RUB', 0.011),
  ('TRY', 0.031),
  ('INR', 0.012),
  ('MYR', 0.22),
  ('THB', 0.029),
  ('PLN', 0.25),
  ('CZK', 0.044),
  ('HUF', 0.0028),
  ('SEK', 0.095),
  ('NOK', 0.093),
  ('DKK', 0.15),
  ('CHF', 1.12),
  ('NZD', 0.61),
  ('ZAR', 0.055),
  ('BRL', 0.20),
  ('MXN', 0.058),
  ('EGP', 0.032),
  ('AED', 0.27),
  ('SAR', 0.27)
ON CONFLICT (currency_code) DO UPDATE SET rate_to_usd = EXCLUDED.rate_to_usd, updated_at = now();

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FX rates are publicly readable" ON public.fx_rates;
CREATE POLICY "FX rates are publicly readable" ON public.fx_rates FOR SELECT USING (true);

-- ============================================================
-- PART 4: Backfill tuition_usd using FX rates
-- ============================================================

UPDATE public.programs SET currency_code = 'USD' WHERE currency_code IS NULL;

UPDATE public.programs p
SET 
  tuition_usd_min = CASE 
    WHEN p.tuition_usd_min IS NOT NULL THEN p.tuition_usd_min
    WHEN p.tuition_yearly IS NOT NULL AND fx.rate_to_usd IS NOT NULL 
    THEN ROUND(p.tuition_yearly * fx.rate_to_usd)
    ELSE p.tuition_yearly
  END,
  tuition_usd_max = CASE 
    WHEN p.tuition_usd_max IS NOT NULL THEN p.tuition_usd_max
    WHEN p.tuition_yearly IS NOT NULL AND fx.rate_to_usd IS NOT NULL 
    THEN ROUND(p.tuition_yearly * fx.rate_to_usd)
    ELSE p.tuition_yearly
  END
FROM public.fx_rates fx
WHERE fx.currency_code = p.currency_code
  AND (p.tuition_usd_min IS NULL OR p.tuition_usd_max IS NULL)
  AND p.tuition_yearly IS NOT NULL;

-- ============================================================
-- PART 5: Recreate View (using actual column names)
-- ============================================================

DROP VIEW IF EXISTS public.vw_program_search_api CASCADE;

CREATE OR REPLACE VIEW public.vw_program_search_api AS
SELECT
  p.id AS program_id,
  -- Program uses single 'title' column for both ar/en
  p.title AS program_name_ar,
  p.title AS program_name_en,
  p.description,
  u.id AS university_id,
  -- University uses single 'name' column for both ar/en
  u.name AS university_name_ar,
  u.name AS university_name_en,
  u.logo_url AS university_logo,
  u.city,
  c.id AS country_id,
  c.country_code,  -- Proper ISO2: RU, DE, CN etc.
  c.name_ar AS country_name_ar,
  COALESCE(c.name_en, c.name_ar) AS country_name_en,
  c.slug AS country_slug,
  d.id AS degree_id,
  d.slug AS degree_slug,
  d.name AS degree_name,
  (
    SELECT array_agg(pl.language_code ORDER BY pl.language_code)
    FROM public.program_languages pl
    WHERE pl.program_id = p.id
  ) AS languages,
  (
    SELECT pl.language_code
    FROM public.program_languages pl
    WHERE pl.program_id = p.id
    ORDER BY pl.language_code
    LIMIT 1
  ) AS language,
  -- USD-converted tuition via FX
  COALESCE(
    p.tuition_usd_min,
    ROUND(p.tuition_yearly * COALESCE(fx.rate_to_usd, 1))
  ) AS tuition_usd_min,
  COALESCE(
    p.tuition_usd_max,
    ROUND(p.tuition_yearly * COALESCE(fx.rate_to_usd, 1))
  ) AS tuition_usd_max,
  p.currency_code,
  p.tuition_yearly AS tuition_local_amount,
  p.duration_months,
  u.ranking,
  COALESCE(p.is_active, true) AS is_active,
  COALESCE(p.publish_status, CASE WHEN p.published = true THEN 'published' ELSE 'draft' END) AS publish_status,
  '/programs/' || c.slug || '/' || p.id::text AS portal_url
FROM public.programs p
JOIN public.universities u ON u.id = p.university_id
JOIN public.countries c ON c.id = u.country_id
LEFT JOIN public.degrees d ON d.id = p.degree_id
LEFT JOIN public.fx_rates fx ON fx.currency_code = p.currency_code;

-- ============================================================
-- PART 6: Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_countries_iso2 ON public.countries(country_code);
CREATE INDEX IF NOT EXISTS idx_languages_code ON public.languages(code);
CREATE INDEX IF NOT EXISTS idx_fx_rates_code ON public.fx_rates(currency_code);

-- ============================================================
-- PART 7: Publish Gate (lenient - only checks on NEW publish)
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_program_publish_requirements()
RETURNS TRIGGER AS $$
DECLARE
  lang_count INT;
BEGIN
  IF NEW.publish_status = 'published' AND 
     (OLD IS NULL OR OLD.publish_status IS DISTINCT FROM 'published') THEN
    
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

CREATE TRIGGER trg_program_publish_gate
  BEFORE INSERT OR UPDATE ON public.programs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_program_publish_requirements();
