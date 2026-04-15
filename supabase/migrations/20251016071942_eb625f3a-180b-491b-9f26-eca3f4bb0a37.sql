-- View تفاصيل البرنامج (باستخدام الحقول الموجودة فعلاً في programs)
CREATE OR REPLACE VIEW vw_program_details AS
SELECT
  p.id                 AS program_id,
  p.title              AS program_name,
  p.duration_months,
  p.ielts_required,
  p.next_intake_date,
  p.next_intake,
  p.description,
  p.languages,
  p.accepted_certificates,
  p.degree_id,
  d.name               AS degree_name,
  d.slug               AS degree_slug,

  u.id                 AS university_id,
  u.name               AS university_name,
  u.city,
  u.logo_url,
  u.ranking,
  u.annual_fees        AS fees_yearly,
  u.monthly_living,

  c.id                 AS country_id,
  c.name               AS country_name,
  c.slug               AS country_slug,
  c.currency_code
FROM programs p
JOIN universities u ON u.id = p.university_id
JOIN countries c    ON c.id = u.country_id
LEFT JOIN degrees d ON d.id = p.degree_id
WHERE COALESCE(p.is_active, true) AND COALESCE(u.is_active, true);

-- فهرسة لسرعة الوصول
CREATE INDEX IF NOT EXISTS idx_program_id ON programs(id);

-- جدول الأحداث التحليلية
CREATE TABLE IF NOT EXISTS analytics_events (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL,
  session_id text NULL,
  tab text NOT NULL,
  event text NOT NULL,
  payload jsonb,
  latency_ms int NULL,
  route text NULL,
  ip inet NULL
);

CREATE INDEX IF NOT EXISTS idx_ae_at ON analytics_events(at DESC);
CREATE INDEX IF NOT EXISTS idx_ae_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ae_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_ae_tab ON analytics_events(tab);