-- ==========================================
-- 1) فهارس للبرامج والجامعات
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_programs_university ON programs (university_id);
CREATE INDEX IF NOT EXISTS idx_programs_degree ON programs (degree_id);
CREATE INDEX IF NOT EXISTS idx_programs_active ON programs (is_active);
CREATE INDEX IF NOT EXISTS idx_programs_intake_date ON programs (next_intake_date);
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities (country_id);
CREATE INDEX IF NOT EXISTS idx_universities_active ON universities (is_active);

-- ==========================================
-- 2) View للبرامج - vw_program_search
-- ==========================================
CREATE OR REPLACE VIEW vw_program_search AS
SELECT
  p.id AS program_id,
  p.title AS program_name,
  p.description,
  p.duration_months,
  p.ielts_required,
  p.languages,
  p.next_intake,
  p.next_intake_date,
  p.accepted_certificates,
  u.id AS university_id,
  u.name AS university_name,
  u.city,
  u.logo_url,
  u.annual_fees AS fees_yearly,
  u.monthly_living,
  u.ranking,
  c.id AS country_id,
  c.slug AS country_slug,
  c.name AS country_name,
  c.currency_code,
  p.degree_id,
  d.name AS degree_name,
  d.slug AS degree_slug
FROM programs p
JOIN universities u ON u.id = p.university_id
JOIN countries c ON c.id = u.country_id
LEFT JOIN degrees d ON d.id = p.degree_id
WHERE COALESCE(p.is_active, true) = true
  AND COALESCE(u.is_active, true) = true;

-- ==========================================
-- 3) فهارس للمنح
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_scholarships_country ON scholarships (country_id);
CREATE INDEX IF NOT EXISTS idx_scholarships_degree ON scholarships (degree_id);
CREATE INDEX IF NOT EXISTS idx_scholarships_amount ON scholarships (amount);
CREATE INDEX IF NOT EXISTS idx_scholarships_deadline ON scholarships (deadline);
CREATE INDEX IF NOT EXISTS idx_scholarships_status ON scholarships (status);
CREATE INDEX IF NOT EXISTS idx_scholarships_university ON scholarships (university_id);

-- ==========================================
-- 4) View للمنح - vw_scholarship_search
-- ==========================================
CREATE OR REPLACE VIEW vw_scholarship_search AS
SELECT
  s.id,
  s.title,
  s.amount,
  COALESCE(c.currency_code, 'USD') AS currency_code,
  s.deadline,
  s.url,
  s.source AS provider_name,
  s.status,
  s.university_id,
  u.name AS university_name,
  u.city AS university_city,
  u.logo_url AS university_logo,
  c.id AS country_id,
  c.slug AS country_slug,
  c.name AS country_name,
  s.degree_id,
  d.name AS degree_name,
  d.slug AS degree_slug
FROM scholarships s
LEFT JOIN universities u ON u.id = s.university_id
LEFT JOIN countries c ON c.id = COALESCE(s.country_id, u.country_id)
LEFT JOIN degrees d ON d.id = s.degree_id
WHERE s.status = 'published';

-- ==========================================
-- 5) View للفعاليات - vw_events_search
-- (مؤقتة - سيتم تحديثها عند إنشاء جدول events)
-- ==========================================
CREATE OR REPLACE VIEW vw_events_search AS
SELECT
  NULL::uuid AS id,
  ''::text AS title,
  ''::text AS event_type,
  now()::date AS start_at,
  now()::date AS end_at,
  ''::text AS organizer,
  ''::text AS url,
  ''::text AS city,
  false::boolean AS is_online,
  ''::text AS venue_name,
  NULL::uuid AS country_id,
  ''::text AS country_slug,
  ''::text AS country_name
WHERE false;

-- ==========================================
-- 6) RLS للـ Views (قراءة عامة)
-- ==========================================
ALTER VIEW vw_program_search SET (security_invoker = false);
ALTER VIEW vw_scholarship_search SET (security_invoker = false);
ALTER VIEW vw_events_search SET (security_invoker = false);