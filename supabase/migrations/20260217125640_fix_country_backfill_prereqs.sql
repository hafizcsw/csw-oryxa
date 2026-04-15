INSERT INTO countries (name_en, name_ar, slug, country_code)
SELECT 'Dominican Republic', 'جمهورية الدومينيكان', 'dominican-republic', 'DO'
WHERE NOT EXISTS (
  SELECT 1 FROM countries WHERE country_code = 'DO'
);

INSERT INTO countries (name_en, name_ar, slug, country_code)
SELECT 'Democratic Republic of the Congo', 'جمهورية الكونغو الديمقراطية', 'democratic-republic-of-the-congo', 'CD'
WHERE NOT EXISTS (
  SELECT 1 FROM countries WHERE country_code = 'CD'
);
