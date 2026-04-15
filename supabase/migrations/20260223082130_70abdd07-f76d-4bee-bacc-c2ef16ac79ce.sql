
DROP VIEW IF EXISTS vw_university_details;

CREATE VIEW vw_university_details AS
SELECT 
  u.id AS university_id,
  u.name AS university_name,
  u.city,
  u.logo_url,
  u.hero_image_url,
  u.main_image_url,
  u.ranking,
  u.annual_fees,
  u.monthly_living,
  u.description,
  u.has_dorm,
  u.dorm_price_monthly_local,
  u.university_type,
  u.acceptance_rate,
  u.enrolled_students,
  qs.world_rank AS qs_world_rank,
  qs.national_rank AS qs_national_rank,
  ur.world_rank AS uniranks_national_rank,
  c.id AS country_id,
  c.name_ar AS country_name,
  c.slug AS country_slug,
  c.currency_code,
  count(p.id) AS programs_count,
  min(p.ielts_required) AS min_program_ielts,
  min(p.next_intake_date) AS next_program_intake
FROM universities u
JOIN countries c ON c.id = u.country_id
LEFT JOIN programs p ON p.university_id = u.id AND COALESCE(p.is_active, true) = true
LEFT JOIN institution_rankings qs ON qs.institution_id = u.id AND qs.ranking_system = 'qs'
LEFT JOIN institution_rankings ur ON ur.institution_id = u.id AND ur.ranking_system = 'uniranks' AND ur.is_primary = true
GROUP BY u.id, c.id, qs.world_rank, qs.national_rank, ur.world_rank;
