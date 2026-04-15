-- LAV #15: Extend university search view with degree/certificate signals (fixed)
-- Drop existing views with CASCADE to handle dependencies
DROP VIEW IF EXISTS vw_university_search_ext CASCADE;
DROP VIEW IF EXISTS vw_university_program_signals CASCADE;

-- Create enhanced view with degree/certificate aggregation
CREATE OR REPLACE VIEW vw_university_program_signals AS
SELECT
  p.university_id,
  MIN(p.duration_months) AS min_duration_months,
  MIN(CASE 
    WHEN 'IELTS' = ANY(p.accepted_certificates) THEN 6.0
    ELSE NULL
  END) AS min_english_requirement,
  MIN(p.next_intake) AS next_intake,
  ARRAY_AGG(DISTINCT p.degree_id) FILTER (WHERE p.degree_id IS NOT NULL) AS degree_ids,
  ARRAY_AGG(DISTINCT cert) FILTER (WHERE cert IS NOT NULL) AS certificate_types
FROM programs p
CROSS JOIN LATERAL unnest(p.accepted_certificates) AS cert
WHERE COALESCE(p.is_active, true)
GROUP BY p.university_id;

-- Recreate vw_university_search_ext with enhanced signals
CREATE OR REPLACE VIEW vw_university_search_ext AS
SELECT 
  u.id,
  u.name,
  u.city,
  u.logo_url,
  u.website,
  u.description,
  u.annual_fees,
  u.monthly_living,
  u.ranking,
  u.is_active,
  u.country_id,
  c.slug AS country_slug,
  c.name AS country_name,
  s.min_duration_months,
  s.min_english_requirement,
  s.next_intake,
  s.degree_ids,
  s.certificate_types
FROM universities u
LEFT JOIN countries c ON c.id = u.country_id
LEFT JOIN vw_university_program_signals s ON s.university_id = u.id
WHERE COALESCE(u.is_active, true);

-- Grant access
GRANT SELECT ON vw_university_program_signals TO anon, authenticated;
GRANT SELECT ON vw_university_search_ext TO anon, authenticated;