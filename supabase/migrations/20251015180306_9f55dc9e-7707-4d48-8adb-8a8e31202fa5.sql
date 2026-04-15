-- LAV #15: University Search Views + Indexes
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_universities_name_trgm ON universities USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_universities_fees ON universities (annual_fees) WHERE annual_fees IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_universities_living ON universities (monthly_living) WHERE monthly_living IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities (country_id);
CREATE INDEX IF NOT EXISTS idx_universities_ranking ON universities (ranking) WHERE ranking IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_universities_active ON universities (is_active) WHERE is_active = true;

-- Program indexes for signals
CREATE INDEX IF NOT EXISTS idx_programs_university ON programs (university_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_programs_degree ON programs (degree_id);
CREATE INDEX IF NOT EXISTS idx_programs_duration ON programs (duration_months);

-- View for program signals per university
CREATE OR REPLACE VIEW vw_university_program_signals AS
SELECT
  p.university_id,
  MIN(p.duration_months) AS min_duration_months,
  MIN(CASE 
    WHEN 'IELTS' = ANY(p.accepted_certificates) THEN 6.0
    WHEN 'TOEFL' = ANY(p.accepted_certificates) THEN 80.0
    ELSE NULL
  END) AS min_english_requirement,
  MIN(p.next_intake) AS next_intake
FROM programs p
WHERE COALESCE(p.is_active, true) = true
GROUP BY p.university_id;

-- Extended university search view with program signals
CREATE OR REPLACE VIEW vw_university_search_ext AS
SELECT
  u.id,
  u.name,
  u.city,
  u.logo_url,
  u.annual_fees,
  u.monthly_living,
  u.ranking,
  u.description,
  u.website,
  u.is_active,
  c.id AS country_id,
  c.slug AS country_slug,
  c.name AS country_name,
  s.min_duration_months,
  s.min_english_requirement,
  s.next_intake
FROM universities u
JOIN countries c ON c.id = u.country_id
LEFT JOIN vw_university_program_signals s ON s.university_id = u.id
WHERE COALESCE(u.is_active, true) = true;