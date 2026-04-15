-- LAV #16: University Details View + Apply Tables

-- 1) View تفاصيل الجامعة مع إشارات البرامج
CREATE OR REPLACE VIEW vw_university_details AS
SELECT
  u.id                 AS university_id,
  u.name               AS university_name,
  u.city,
  u.logo_url,
  u.ranking,
  u.annual_fees,
  u.monthly_living,
  u.description,

  c.id                 AS country_id,
  c.name               AS country_name,
  c.slug               AS country_slug,
  c.currency_code,

  COUNT(p.id)                           AS programs_count,
  MIN(p.ielts_required)                 AS min_program_ielts,
  MIN(p.next_intake_date)               AS next_program_intake
FROM universities u
JOIN countries c ON c.id = u.country_id
LEFT JOIN programs p ON p.university_id = u.id AND COALESCE(p.is_active, true) = true
GROUP BY u.id, c.id;

-- 2) جداول التقديم
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid,
  created_at timestamptz DEFAULT now(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  country_slug text,
  notes text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','submitted','rejected','accepted'))
);

CREATE TABLE IF NOT EXISTS application_items (
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  university_id uuid NOT NULL,
  program_id uuid,
  PRIMARY KEY (application_id, university_id)
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_app_created ON applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_status ON applications (status);

-- RLS للتقديمات (Admin فقط)
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_admin_select ON applications;
CREATE POLICY app_admin_select ON applications 
  FOR SELECT 
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS app_admin_all ON applications;
CREATE POLICY app_admin_all ON applications 
  FOR ALL 
  TO authenticated
  USING (public.is_admin(auth.uid())) 
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS appi_admin_select ON application_items;
CREATE POLICY appi_admin_select ON application_items 
  FOR SELECT 
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS appi_admin_all ON application_items;
CREATE POLICY appi_admin_all ON application_items 
  FOR ALL 
  TO authenticated
  USING (public.is_admin(auth.uid())) 
  WITH CHECK (public.is_admin(auth.uid()));