
-- =====================================================
-- PORTAL CLOSEOUT: Final Fixes for Scholarships MVP
-- =====================================================

-- 1) FIX VIEW: Add percent inference logic (CRITICAL)
CREATE OR REPLACE VIEW public.vw_scholarship_search_api AS
SELECT 
  s.id AS scholarship_id,
  s.title,
  s.description,
  s.status,
  COALESCE(s.is_active, true) AS is_active,
  s.university_id,
  u.name AS university_name,
  u.logo_url AS university_logo,
  COALESCE(s.country_id, u.country_id) AS country_id,
  COALESCE(s.country_code, c.country_code) AS country_code,
  c.name_ar AS country_name_ar,
  c.name_en AS country_name_en,
  c.slug AS country_slug,
  s.degree_id,
  COALESCE(s.degree_slug, s.degree_level, d.slug) AS degree_slug,
  COALESCE(d.name, s.degree_level) AS degree_name,
  s.study_level,
  -- FIXED: Proper amount_type inference including PERCENT
  COALESCE(
    s.amount_type,
    CASE
      -- Percent first (if percent_value exists)
      WHEN s.percent_value IS NOT NULL AND s.percent_value > 0 THEN 'percent'
      -- Full coverage
      WHEN s.coverage_type = 'full' THEN 'full'
      -- Fixed amount
      WHEN COALESCE(s.amount_value, s.amount) IS NOT NULL AND COALESCE(s.amount_value, s.amount) > 0 THEN 'fixed'
      ELSE 'partial'
    END
  ) AS amount_type,
  COALESCE(s.amount_value, s.amount) AS amount_value,
  s.percent_value,
  s.currency_code,
  s.coverage_type,
  s.coverage,
  s.deadline,
  COALESCE(s.link, s.url, s.application_url) AS link,
  s.eligibility,
  s.source,
  s.source_name,
  s.provider,
  s.academic_year,
  s.created_at,
  s.updated_at,
  s.image_url,
  s.beneficiaries_count,
  s.acceptance_rate,
  s.rating
FROM public.scholarships s
LEFT JOIN public.universities u ON u.id = s.university_id
LEFT JOIN public.countries c ON c.id = COALESCE(s.country_id, u.country_id)
LEFT JOIN public.degrees d ON d.id = s.degree_id;

-- 2) Ensure grants on view
GRANT SELECT ON public.vw_scholarship_search_api TO anon, authenticated;

-- 3) Update 10 scholarships to be publishable (mix of types)
-- First: 4 FIXED scholarships (already have amount + currency)
UPDATE public.scholarships 
SET 
  amount_type = 'fixed',
  status = 'published',
  is_active = true
WHERE id IN (
  '8d4a8480-3267-4678-9fcf-add7a0909c77', -- DAAD Scholarship 12000
  '1828733d-3e50-4a3b-85b9-77565d0fcc60', -- TUM Excellence 15000
  '482f311a-f65d-440a-961e-31062d034e09', -- LMU International 10000
  '2b94675a-3327-4ace-9d0c-ec03f66d541a'  -- RWTH Merit 8000
);

-- Second: 3 PERCENT scholarships 
UPDATE public.scholarships 
SET 
  amount_type = 'percent',
  percent_value = CASE 
    WHEN id = '59e61e71-72bb-4819-951c-29e0b975ba1b' THEN 50
    WHEN id = '459d6cfa-5878-48d0-8398-9caee11f0b38' THEN 75
    WHEN id = '4900a818-6b8f-43cc-838f-3ca2a02287be' THEN 25
  END,
  status = 'published',
  is_active = true
WHERE id IN (
  '59e61e71-72bb-4819-951c-29e0b975ba1b', -- Merit Scholarship A -> 50%
  '459d6cfa-5878-48d0-8398-9caee11f0b38', -- Merit Scholarship B -> 75%
  '4900a818-6b8f-43cc-838f-3ca2a02287be'  -- STEM Scholarship -> 25%
);

-- Third: 3 FULL scholarships
UPDATE public.scholarships 
SET 
  amount_type = 'full',
  coverage_type = 'full',
  status = 'published',
  is_active = true
WHERE id IN (
  'dd6b2836-ca79-4db5-8bf5-0b426614cf4a', -- Need-based Grant -> Full
  'e0ea50b6-ef78-4b93-b6f9-be9ade74c5e5', -- International Award -> Full
  '98744066-f79b-48a5-8b06-311d547e4060'  -- LMU Excellence -> Full
);
