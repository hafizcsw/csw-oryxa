-- Add main_image_url to vw_university_card VIEW
DROP VIEW IF EXISTS vw_university_card CASCADE;

CREATE VIEW vw_university_card AS
SELECT
  u.id,
  u.name,
  u.city,
  u.logo_url,
  u.main_image_url AS image_url,
  u.annual_fees,
  u.monthly_living,
  u.ranking,
  u.description,
  c.id AS country_id,
  c.slug AS country_slug,
  c.name AS country_name,
  COALESCE(c.currency_code, 'USD') AS currency_code,
  s.min_duration_months,
  s.min_ielts_required,
  s.next_intake_date,
  s.degree_ids
FROM universities u
JOIN countries c ON c.id = u.country_id
LEFT JOIN vw_university_program_signals s ON s.university_id = u.id
WHERE COALESCE(u.is_active, true) = true;