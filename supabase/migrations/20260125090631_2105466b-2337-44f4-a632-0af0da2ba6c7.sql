-- ORDER #3 Stable API View: Maps internal columns to fixed contract names
-- This view insulates the Edge Function from any future schema changes

CREATE OR REPLACE VIEW public.vw_program_search_api AS
SELECT
  -- Program identifiers
  program_id,
  program_name AS program_name_ar,
  program_name AS program_name_en,
  description,
  
  -- University
  university_id,
  university_name AS university_name_ar,
  university_name AS university_name_en,
  logo_url AS university_logo,
  
  -- Location
  country_id,
  UPPER(country_slug) AS country_code,
  country_name AS country_name_ar,
  country_name AS country_name_en,
  city,
  
  -- Degree
  degree_id,
  degree_slug,
  degree_name,
  
  -- Languages (extract first as primary)
  languages,
  languages[1] AS language,
  
  -- Tuition (map fees_yearly to ORDER #3 expected names)
  fees_yearly AS tuition_usd_min,
  fees_yearly AS tuition_usd_max,
  currency_code,
  monthly_living,
  
  -- Other
  duration_months,
  ranking,
  ielts_required,
  next_intake,
  next_intake_date,
  accepted_certificates,
  
  -- Generate portal_url
  '/programs/' || country_slug || '/' || program_id AS portal_url

FROM public.vw_program_search;