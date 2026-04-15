-- First ensure SEO fields exist in countries table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='countries' AND column_name='seo_title') THEN
    ALTER TABLE countries
      ADD COLUMN seo_title text,
      ADD COLUMN seo_description text,
      ADD COLUMN seo_h1 text,
      ADD COLUMN seo_canonical_url text,
      ADD COLUMN seo_index boolean DEFAULT true,
      ADD COLUMN seo_last_reviewed_at timestamptz;
  END IF;
END $$;

-- Now insert/update country data with SEO fields
INSERT INTO countries (slug, name, seo_title, seo_description, seo_h1, seo_index, seo_canonical_url, seo_last_reviewed_at)
VALUES
('russia', 'روسيا', 'الدراسة في روسيا: جامعات ورسوم 2026', 'دليل مختصر للجامعات والبرامج والرسوم والمنح في روسيا للطلاب الدوليين.', 'الدراسة في روسيا', true, 'https://connectstudyworld.com/study-in/russia', now()),
('germany', 'ألمانيا', 'الدراسة في ألمانيا: جامعات ورسوم 2026', 'أهم الجامعات والبرامج والرسوم والمنح في ألمانيا للطلاب الدوليين.', 'الدراسة في ألمانيا', true, 'https://connectstudyworld.com/study-in/germany', now()),
('united-kingdom', 'بريطانيا', 'الدراسة في بريطانيا: جامعات ورسوم 2026', 'جامعات بريطانيا، أفضل البرامج، الرسوم، شروط القبول والمنح للطلاب الدوليين.', 'الدراسة في بريطانيا', true, 'https://connectstudyworld.com/study-in/united-kingdom', now()),
('spain', 'إسبانيا', 'الدراسة في إسبانيا: جامعات ورسوم 2026', 'الجامعات والبرامج والرسوم والمنح في إسبانيا للطلاب الدوليين.', 'الدراسة في إسبانيا', true, 'https://connectstudyworld.com/study-in/spain', now()),
('canada', 'كندا', 'الدراسة في كندا: جامعات ورسوم 2026', 'أفضل الجامعات والبرامج والرسوم والمنح في كندا للطلاب الدوليين.', 'الدراسة في كندا', true, 'https://connectstudyworld.com/study-in/canada', now()),
('netherlands', 'هولندا', 'الدراسة في هولندا: جامعات ورسوم 2026', 'جامعات هولندا، البرامج المتاحة، الرسوم، والمنح للطلاب الدوليين.', 'الدراسة في هولندا', true, 'https://connectstudyworld.com/study-in/netherlands', now())
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description,
  seo_h1 = EXCLUDED.seo_h1,
  seo_index = true,
  seo_canonical_url = EXCLUDED.seo_canonical_url,
  seo_last_reviewed_at = now();