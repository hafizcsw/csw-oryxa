
-- Step 1: Drop dependent view first
DROP VIEW IF EXISTS vw_university_card;

-- Step 2: Recreate vw_university_program_signals with new columns
CREATE OR REPLACE VIEW vw_university_program_signals AS
SELECT 
  university_id,
  min(duration_months) AS min_duration_months,
  min(ielts_required) AS min_ielts_required,
  min(next_intake_date) AS next_intake_date,
  array_agg(DISTINCT degree_id) FILTER (WHERE degree_id IS NOT NULL) AS degree_ids,
  COUNT(*)::int AS program_count,
  min(tuition_usd_min) AS tuition_usd_min,
  max(tuition_usd_max) AS tuition_usd_max
FROM programs
WHERE COALESCE(is_active, true) = true
GROUP BY university_id;

-- Step 3: Recreate vw_university_card with all new columns
CREATE VIEW vw_university_card AS
SELECT 
  u.id, u.name, u.city, u.logo_url, u.main_image_url AS image_url,
  u.annual_fees, u.monthly_living, u.description,
  u.acceptance_rate, u.enrolled_students,
  u.has_dorm, u.dorm_price_monthly_local, u.university_type,
  qs.world_rank AS qs_world_rank,
  qs.national_rank AS qs_national_rank,
  ur.world_rank AS uniranks_national_rank,
  COALESCE(qs.world_rank, ur.world_rank) AS world_rank,
  c.id AS country_id, c.slug AS country_slug, c.name_ar AS country_name,
  COALESCE(c.currency_code, 'USD') AS currency_code,
  s.min_duration_months, s.min_ielts_required, s.next_intake_date,
  s.degree_ids, s.program_count,
  s.tuition_usd_min, s.tuition_usd_max
FROM universities u
JOIN countries c ON c.id = u.country_id
LEFT JOIN vw_university_program_signals s ON s.university_id = u.id
LEFT JOIN institution_rankings qs ON qs.institution_id = u.id AND qs.ranking_system = 'qs' AND qs.is_primary = true
LEFT JOIN institution_rankings ur ON ur.institution_id = u.id AND ur.ranking_system = 'uniranks' AND ur.is_primary = true
WHERE COALESCE(u.is_active, true) = true;
