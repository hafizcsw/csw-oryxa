-- Update existing countries or insert new ones with SEO data
DO $$
BEGIN
  -- Germany
  IF EXISTS (SELECT 1 FROM countries WHERE name = 'ألمانيا') THEN
    UPDATE countries SET
      seo_title = 'الدراسة في ألمانيا 2026 - جامعات ورسوم وبرامج',
      seo_description = 'دليل شامل للدراسة في ألمانيا: أفضل الجامعات، البرامج المتاحة، الرسوم الدراسية، شروط القبول والمنح الدراسية للطلاب الدوليين.',
      seo_h1 = 'الدراسة في ألمانيا',
      seo_index = true,
      image_url = '/assets/countries/germany.jpg',
      seo_last_reviewed_at = now()
    WHERE name = 'ألمانيا';
  ELSE
    INSERT INTO countries (name, seo_title, seo_description, seo_h1, seo_index, image_url)
    VALUES ('ألمانيا', 'الدراسة في ألمانيا 2026 - جامعات ورسوم وبرامج',
            'دليل شامل للدراسة في ألمانيا: أفضل الجامعات، البرامج المتاحة، الرسوم الدراسية، شروط القبول والمنح الدراسية للطلاب الدوليين.',
            'الدراسة في ألمانيا', true, '/assets/countries/germany.jpg');
  END IF;

  -- UK
  IF EXISTS (SELECT 1 FROM countries WHERE name = 'بريطانيا') THEN
    UPDATE countries SET
      seo_title = 'الدراسة في بريطانيا 2026 - جامعات ورسوم وبرامج',
      seo_description = 'دليل كامل للدراسة في بريطانيا: أفضل الجامعات البريطانية، البرامج، الرسوم، القبول، والمنح الدراسية.',
      seo_h1 = 'الدراسة في بريطانيا',
      seo_index = true,
      image_url = '/assets/countries/uk.jpg',
      seo_last_reviewed_at = now()
    WHERE name = 'بريطانيا';
  ELSE
    INSERT INTO countries (name, seo_title, seo_description, seo_h1, seo_index, image_url)
    VALUES ('بريطانيا', 'الدراسة في بريطانيا 2026 - جامعات ورسوم وبرامج',
            'دليل كامل للدراسة في بريطانيا: أفضل الجامعات البريطانية، البرامج، الرسوم، القبول، والمنح الدراسية.',
            'الدراسة في بريطانيا', true, '/assets/countries/uk.jpg');
  END IF;

  -- Russia
  IF EXISTS (SELECT 1 FROM countries WHERE name = 'روسيا') THEN
    UPDATE countries SET
      seo_title = 'الدراسة في روسيا 2026 - جامعات ورسوم وبرامج',
      seo_description = 'كل ما تحتاج معرفته عن الدراسة في روسيا: الجامعات الروسية المعترف بها، البرامج، التكاليف، والمنح.',
      seo_h1 = 'الدراسة في روسيا',
      seo_index = true,
      image_url = '/assets/countries/russia.jpg',
      seo_last_reviewed_at = now()
    WHERE name = 'روسيا';
  ELSE
    INSERT INTO countries (name, seo_title, seo_description, seo_h1, seo_index, image_url)
    VALUES ('روسيا', 'الدراسة في روسيا 2026 - جامعات ورسوم وبرامج',
            'كل ما تحتاج معرفته عن الدراسة في روسيا: الجامعات الروسية المعترف بها، البرامج، التكاليف، والمنح.',
            'الدراسة في روسيا', true, '/assets/countries/russia.jpg');
  END IF;

  -- Spain
  IF EXISTS (SELECT 1 FROM countries WHERE name = 'إسبانيا') THEN
    UPDATE countries SET
      seo_title = 'الدراسة في إسبانيا 2026 - جامعات ورسوم وبرامج',
      seo_description = 'دليلك للدراسة في إسبانيا: الجامعات الإسبانية، البرامج باللغة الإنجليزية، الرسوم، والمنح الدراسية.',
      seo_h1 = 'الدراسة في إسبانيا',
      seo_index = true,
      image_url = '/assets/countries/spain.jpg',
      seo_last_reviewed_at = now()
    WHERE name = 'إسبانيا';
  ELSE
    INSERT INTO countries (name, seo_title, seo_description, seo_h1, seo_index, image_url)
    VALUES ('إسبانيا', 'الدراسة في إسبانيا 2026 - جامعات ورسوم وبرامج',
            'دليلك للدراسة في إسبانيا: الجامعات الإسبانية، البرامج باللغة الإنجليزية، الرسوم، والمنح الدراسية.',
            'الدراسة في إسبانيا', true, '/assets/countries/spain.jpg');
  END IF;

  -- Canada
  IF EXISTS (SELECT 1 FROM countries WHERE name = 'كندا') THEN
    UPDATE countries SET
      seo_title = 'الدراسة في كندا 2026 - جامعات ورسوم وبرامج',
      seo_description = 'دليل الدراسة في كندا: أفضل الجامعات الكندية، البرامج المتنوعة، تكاليف المعيشة، والمنح الدراسية.',
      seo_h1 = 'الدراسة في كندا',
      seo_index = true,
      image_url = '/assets/countries/canada.jpg',
      seo_last_reviewed_at = now()
    WHERE name = 'كندا';
  ELSE
    INSERT INTO countries (name, seo_title, seo_description, seo_h1, seo_index, image_url)
    VALUES ('كندا', 'الدراسة في كندا 2026 - جامعات ورسوم وبرامج',
            'دليل الدراسة في كندا: أفضل الجامعات الكندية، البرامج المتنوعة، تكاليف المعيشة، والمنح الدراسية.',
            'الدراسة في كندا', true, '/assets/countries/canada.jpg');
  END IF;

  -- Netherlands
  IF EXISTS (SELECT 1 FROM countries WHERE name = 'هولندا') THEN
    UPDATE countries SET
      seo_title = 'الدراسة في هولندا 2026 - جامعات ورسوم وبرامج',
      seo_description = 'دليل شامل للدراسة في هولندا: الجامعات الهولندية، البرامج باللغة الإنجليزية، الرسوم، والمنح.',
      seo_h1 = 'الدراسة في هولندا',
      seo_index = true,
      image_url = '/assets/countries/netherlands.jpg',
      seo_last_reviewed_at = now()
    WHERE name = 'هولندا';
  ELSE
    INSERT INTO countries (name, seo_title, seo_description, seo_h1, seo_index, image_url)
    VALUES ('هولندا', 'الدراسة في هولندا 2026 - جامعات ورسوم وبرامج',
            'دليل شامل للدراسة في هولندا: الجامعات الهولندية، البرامج باللغة الإنجليزية، الرسوم، والمنح.',
            'الدراسة في هولندا', true, '/assets/countries/netherlands.jpg');
  END IF;
END $$;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country_id);
CREATE INDEX IF NOT EXISTS idx_programs_university ON programs(university_id);
CREATE INDEX IF NOT EXISTS idx_scholarships_university ON scholarships(university_id);