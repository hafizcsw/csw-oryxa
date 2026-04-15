-- Seed ذكي: برامج/منح/فعاليات (يعمل مع أي جامعات موجودة)

-- 1) برامج (برنامج واحد لكل من أول 8 جامعات)
DO $$
DECLARE
  r RECORD;
  v_degree uuid;
BEGIN
  -- خُذ أي Degree متاح
  SELECT id INTO v_degree FROM degrees ORDER BY name LIMIT 1;

  IF v_degree IS NULL THEN
    RAISE NOTICE 'No degrees found — seed those first.';
    RETURN;
  END IF;

  FOR r IN
    SELECT u.id AS uni_id, u.country_id
    FROM universities u
    WHERE COALESCE(u.is_active, true) = true
    ORDER BY u.name
    LIMIT 8
  LOOP
    -- لا تُكرّر لو عند الجامعة برامج موجودة
    IF NOT EXISTS (SELECT 1 FROM programs p WHERE p.university_id = r.uni_id LIMIT 1) THEN
      INSERT INTO programs (
        title, university_id, degree_id,
        languages, is_active,
        next_intake, next_intake_date, duration_months, ielts_required
      )
      VALUES (
        'Bachelor of Business Administration (Auto)', r.uni_id, v_degree,
        ARRAY['EN']::text[], true,
        'January ' || (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text,
        (CURRENT_DATE + (30 + floor(random()*90))::int),
        36,
        6.0
      );
    END IF;
  END LOOP;
END $$;

-- 2) منح (6 منح)
DO $$
DECLARE
  r RECORD;
  v_degree uuid;
BEGIN
  SELECT id INTO v_degree FROM degrees ORDER BY name LIMIT 1;

  IF v_degree IS NULL THEN
    RAISE NOTICE 'No degrees found.';
    RETURN;
  END IF;

  FOR r IN
    SELECT u.id AS uni_id, u.country_id
    FROM universities u
    WHERE COALESCE(u.is_active, true) = true
    ORDER BY u.name
    LIMIT 6
  LOOP
    INSERT INTO scholarships (
      title, country_id, university_id, degree_id,
      amount, deadline, url, source, status
    )
    VALUES (
      'Merit Scholarship (Auto)', r.country_id, r.uni_id, v_degree,
      2000 + floor(random()*3000)::int,
      (CURRENT_DATE + (60 + floor(random()*120))::int),
      'https://example.com/apply',
      'auto_seed',
      'published'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 3) فعاليات (2 لكل دولة × 3 دول = 6 فعاليات)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.country_id
    FROM universities u
    WHERE COALESCE(u.is_active, true) = true
    GROUP BY u.country_id
    ORDER BY u.country_id
    LIMIT 3
  LOOP
    -- حضوري
    INSERT INTO education_events (
      title, country_id, city, event_type,
      start_at, end_at, organizer, url, is_online, venue_name
    )
    VALUES
      ('Study Info Session (Auto)', r.country_id, 'Main Hall', 'in_person',
        NOW() + interval '15 days', NOW() + interval '15 days 2 hours',
        'Admissions Office', 'https://example.com/register', false, 'Campus Center')
    ON CONFLICT DO NOTHING;
    
    -- أونلاين
    INSERT INTO education_events (
      title, country_id, city, event_type,
      start_at, end_at, organizer, url, is_online, venue_name
    )
    VALUES
      ('Online Q&A (Auto)', r.country_id, NULL, 'online',
        NOW() + interval '30 days', NOW() + interval '30 days 1 hour',
        'International Office', 'https://example.com/register', true, NULL)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;