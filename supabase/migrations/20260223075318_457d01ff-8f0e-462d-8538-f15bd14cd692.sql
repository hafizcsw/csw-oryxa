
DROP VIEW IF EXISTS vw_university_card;

CREATE VIEW vw_university_card AS
SELECT 
  u.id, u.name, u.city, u.logo_url, u.main_image_url AS image_url,
  u.annual_fees, u.monthly_living, u.description,
  u.acceptance_rate, u.enrolled_students,
  ir.world_rank, ir.ranking_system,
  c.id AS country_id, c.slug AS country_slug, c.name_ar AS country_name,
  COALESCE(c.currency_code, 'USD') AS currency_code,
  s.min_duration_months, s.min_ielts_required, s.next_intake_date,
  s.degree_ids
FROM universities u
JOIN countries c ON c.id = u.country_id
LEFT JOIN vw_university_program_signals s ON s.university_id = u.id
LEFT JOIN institution_rankings ir ON ir.institution_id = u.id AND ir.is_primary = true
WHERE COALESCE(u.is_active, true) = true;
