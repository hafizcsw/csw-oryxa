-- Fix security definer view by recreating with security_invoker
DROP VIEW IF EXISTS programs_view;

CREATE OR REPLACE VIEW programs_view
WITH (security_invoker = true)
AS
SELECT
  p.id as program_id,
  p.title,
  d.slug as degree_slug,
  u.id as university_id,
  u.name as university_name,
  c.slug as country_slug,
  u.city,
  u.annual_fees,
  u.monthly_living,
  p.languages,
  p.next_intake,
  u.ranking,
  p.accepted_certificates,
  p.description
FROM programs p
JOIN universities u ON u.id = p.university_id
LEFT JOIN degrees d ON d.id = p.degree_id
LEFT JOIN countries c ON c.id = u.country_id
WHERE p.is_active = true AND u.is_active = true;