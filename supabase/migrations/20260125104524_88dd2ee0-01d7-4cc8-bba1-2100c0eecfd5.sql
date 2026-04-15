-- Check if discipline_id column exists, add if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'programs' AND column_name = 'discipline_id'
  ) THEN
    ALTER TABLE public.programs ADD COLUMN discipline_id UUID REFERENCES public.disciplines(id);
  END IF;
END $$;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_programs_discipline_id ON public.programs(discipline_id);

-- Update existing Business Admin programs to correct discipline
UPDATE public.programs p
SET discipline_id = (SELECT id FROM public.disciplines WHERE slug = 'business')
WHERE discipline_id IS NULL
  AND (p.title ILIKE '%business%' OR p.title ILIKE '%إدارة%');

-- Drop and recreate vw_program_search_api with discipline fields
DROP VIEW IF EXISTS public.vw_program_search_api;

CREATE VIEW public.vw_program_search_api AS
SELECT
  p.id AS program_id,
  p.title AS program_name_ar,
  p.title AS program_name_en,
  p.description,
  u.id AS university_id,
  u.name AS university_name_ar,
  u.name AS university_name_en,
  u.logo_url AS university_logo,
  c.id AS country_id,
  c.country_code,
  c.name_ar AS country_name_ar,
  c.name_en AS country_name_en,
  u.city,
  deg.slug AS degree_slug,
  deg.name AS degree_name,
  -- NEW: Discipline fields for semantic search
  disc.slug AS discipline_slug,
  disc.name_ar AS discipline_name_ar,
  disc.name_en AS discipline_name_en,
  disc.aliases_ar AS discipline_aliases_ar,
  disc.aliases_en AS discipline_aliases_en,
  -- Language fields
  p.language,
  COALESCE(
    (SELECT array_agg(pl.language_code) FROM public.program_languages pl WHERE pl.program_id = p.id),
    CASE WHEN p.language IS NOT NULL THEN ARRAY[p.language] ELSE ARRAY[]::TEXT[] END
  ) AS languages,
  -- Tuition with FX conversion
  CASE 
    WHEN COALESCE(p.tuition_is_free, false) THEN 0
    WHEN UPPER(COALESCE(p.currency_code, 'USD')) = 'USD' THEN COALESCE(p.tuition_local_min, p.tuition_usd_min)
    ELSE ROUND(COALESCE(p.tuition_local_min, 0) / COALESCE(fx.rate_to_usd, 1))
  END AS tuition_usd_min,
  CASE 
    WHEN COALESCE(p.tuition_is_free, false) THEN 0
    WHEN UPPER(COALESCE(p.currency_code, 'USD')) = 'USD' THEN COALESCE(p.tuition_local_max, p.tuition_usd_max)
    ELSE ROUND(COALESCE(p.tuition_local_max, 0) / COALESCE(fx.rate_to_usd, 1))
  END AS tuition_usd_max,
  p.currency_code,
  p.tuition_local_min AS tuition_local_amount,
  COALESCE(p.tuition_is_free, false) AS tuition_is_free,
  u.ranking,
  p.duration_months,
  CONCAT('/programs/', p.program_slug) AS portal_url,
  COALESCE(p.is_active, true) AS is_active,
  COALESCE(p.publish_status, 'draft') AS publish_status
FROM public.programs p
JOIN public.universities u ON u.id = p.university_id
JOIN public.countries c ON c.id = u.country_id
LEFT JOIN public.degrees deg ON deg.id = p.degree_id
LEFT JOIN public.disciplines disc ON disc.id = p.discipline_id
LEFT JOIN public.fx_rates fx ON UPPER(fx.currency_code) = UPPER(p.currency_code)
WHERE p.university_id IS NOT NULL
  AND u.country_id IS NOT NULL;