-- إنشاء جدول الفعاليات التعليمية
CREATE TABLE IF NOT EXISTS education_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  country_id uuid REFERENCES countries(id),
  city text,
  event_type text CHECK (event_type IN ('in_person', 'online', 'hybrid')),
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  organizer text,
  url text,
  is_online boolean DEFAULT false,
  venue_name text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- تفعيل RLS - القراءة عامة
ALTER TABLE education_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_select_public ON education_events
  FOR SELECT USING (true);

-- Seed بيانات تجريبية للفعاليات
INSERT INTO education_events (title, country_id, city, event_type, start_at, end_at, organizer, url, is_online, venue_name, description)
SELECT
  'Study Abroad Info Session',
  u.country_id,
  u.city,
  'in_person',
  NOW() + INTERVAL '15 days',
  NOW() + INTERVAL '15 days 2 hours',
  'Admissions Office',
  'https://example.com/register',
  false,
  'Campus Center',
  'معرض شامل للدراسة في الخارج مع ممثلي الجامعات'
FROM universities u
WHERE NOT EXISTS (SELECT 1 FROM education_events WHERE title = 'Study Abroad Info Session')
LIMIT 2;

-- تحديث الـ view لاستخدام الجدول الجديد
DROP VIEW IF EXISTS vw_events_search;
CREATE OR REPLACE VIEW vw_events_search AS
SELECT
  e.id,
  e.title,
  e.event_type,
  e.start_at,
  e.end_at,
  e.organizer,
  e.url,
  e.city,
  e.is_online,
  e.venue_name,
  c.id as country_id,
  c.name as country_name,
  c.slug as country_slug
FROM education_events e
LEFT JOIN countries c ON c.id = e.country_id;