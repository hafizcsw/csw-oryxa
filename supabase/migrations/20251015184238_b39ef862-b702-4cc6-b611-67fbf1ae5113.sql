-- 1) إضافة الحقول الأساسية للجامعات (آمنة: IF NOT EXISTS)
ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS city               text,
  ADD COLUMN IF NOT EXISTS annual_fees        numeric,
  ADD COLUMN IF NOT EXISTS monthly_living     numeric,
  ADD COLUMN IF NOT EXISTS ranking            integer,
  ADD COLUMN IF NOT EXISTS logo_url           text,
  ADD COLUMN IF NOT EXISTS description        text;

-- 2) إضافة عملة الدولة
ALTER TABLE countries
  ADD COLUMN IF NOT EXISTS currency_code char(3);

UPDATE countries SET currency_code = 'USD' WHERE currency_code IS NULL;

-- 3) إضافة حقول البرامج للإشارات
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS duration_months      integer,
  ADD COLUMN IF NOT EXISTS ielts_required       numeric,
  ADD COLUMN IF NOT EXISTS next_intake_date     date;

-- 4) حذف الـ VIEWs القديمة إن وجدت
DROP VIEW IF EXISTS vw_university_card CASCADE;
DROP VIEW IF EXISTS vw_university_program_signals CASCADE;

-- 5) VIEW جديد للإشارات من البرامج
CREATE VIEW vw_university_program_signals AS
SELECT
  p.university_id,
  MIN(p.duration_months)                  AS min_duration_months,
  MIN(p.ielts_required)                   AS min_ielts_required,
  MIN(p.next_intake_date)                 AS next_intake_date,
  ARRAY_AGG(DISTINCT p.degree_id) FILTER (WHERE p.degree_id IS NOT NULL) AS degree_ids
FROM programs p
WHERE COALESCE(p.is_active, true) = true
GROUP BY p.university_id;

-- 6) VIEW للبطاقة الكاملة
CREATE VIEW vw_university_card AS
SELECT
  u.id,
  u.name,
  u.city,
  u.logo_url,
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

-- 7) الفهارس للأداء
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country_id);
CREATE INDEX IF NOT EXISTS idx_universities_fees    ON universities(annual_fees);
CREATE INDEX IF NOT EXISTS idx_universities_living  ON universities(monthly_living);
CREATE INDEX IF NOT EXISTS idx_universities_ranking ON universities(ranking);
CREATE INDEX IF NOT EXISTS idx_programs_university  ON programs(university_id);
CREATE INDEX IF NOT EXISTS idx_programs_intake      ON programs(next_intake_date);