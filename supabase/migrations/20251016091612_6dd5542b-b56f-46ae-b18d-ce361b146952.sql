-- LAV #16 Seed - Direct INSERT approach

-- UK Universities (Direct INSERT)
INSERT INTO universities (country_id, name, city, ranking, annual_fees, monthly_living, is_active)
SELECT 
  (SELECT id FROM countries WHERE slug = 'uk'),
  'University of London', 'London', 300, 18000, 1200, true
WHERE NOT EXISTS (
  SELECT 1 FROM universities u 
  WHERE u.name = 'University of London' 
  AND u.country_id = (SELECT id FROM countries WHERE slug = 'uk')
);

INSERT INTO universities (country_id, name, city, ranking, annual_fees, monthly_living, is_active)
SELECT 
  (SELECT id FROM countries WHERE slug = 'uk'),
  'University of Manchester', 'Manchester', 200, 17000, 1000, true
WHERE NOT EXISTS (
  SELECT 1 FROM universities u 
  WHERE u.name = 'University of Manchester' 
  AND u.country_id = (SELECT id FROM countries WHERE slug = 'uk')
);

INSERT INTO universities (country_id, name, city, ranking, annual_fees, monthly_living, is_active)
SELECT 
  (SELECT id FROM countries WHERE slug = 'uk'),
  'University of Glasgow', 'Glasgow', 240, 16000, 900, true
WHERE NOT EXISTS (
  SELECT 1 FROM universities u 
  WHERE u.name = 'University of Glasgow' 
  AND u.country_id = (SELECT id FROM countries WHERE slug = 'uk')
);

-- DE Universities
INSERT INTO universities (country_id, name, city, ranking, annual_fees, monthly_living, is_active)
SELECT 
  (SELECT id FROM countries WHERE slug = 'de'),
  'Technical University of Munich', 'Munich', 50, 500, 1000, true
WHERE NOT EXISTS (
  SELECT 1 FROM universities u 
  WHERE u.name = 'Technical University of Munich' 
  AND u.country_id = (SELECT id FROM countries WHERE slug = 'de')
);

INSERT INTO universities (country_id, name, city, ranking, annual_fees, monthly_living, is_active)
SELECT 
  (SELECT id FROM countries WHERE slug = 'de'),
  'LMU Munich', 'Munich', 59, 500, 1000, true
WHERE NOT EXISTS (
  SELECT 1 FROM universities u 
  WHERE u.name = 'LMU Munich' 
  AND u.country_id = (SELECT id FROM countries WHERE slug = 'de')
);

INSERT INTO universities (country_id, name, city, ranking, annual_fees, monthly_living, is_active)
SELECT 
  (SELECT id FROM countries WHERE slug = 'de'),
  'RWTH Aachen University', 'Aachen', 99, 500, 900, true
WHERE NOT EXISTS (
  SELECT 1 FROM universities u 
  WHERE u.name = 'RWTH Aachen University' 
  AND u.country_id = (SELECT id FROM countries WHERE slug = 'de')
);

-- TR Universities
INSERT INTO universities (country_id, name, city, ranking, annual_fees, monthly_living, is_active)
SELECT 
  (SELECT id FROM countries WHERE slug = 'tr'),
  'Istanbul University', 'Istanbul', 801, 2500, 700, true
WHERE NOT EXISTS (
  SELECT 1 FROM universities u 
  WHERE u.name = 'Istanbul University' 
  AND u.country_id = (SELECT id FROM countries WHERE slug = 'tr')
);

INSERT INTO universities (country_id, name, city, ranking, annual_fees, monthly_living, is_active)
SELECT 
  (SELECT id FROM countries WHERE slug = 'tr'),
  'Middle East Technical University', 'Ankara', 501, 3000, 700, true
WHERE NOT EXISTS (
  SELECT 1 FROM universities u 
  WHERE u.name = 'Middle East Technical University' 
  AND u.country_id = (SELECT id FROM countries WHERE slug = 'tr')
);

INSERT INTO universities (country_id, name, city, ranking, annual_fees, monthly_living, is_active)
SELECT 
  (SELECT id FROM countries WHERE slug = 'tr'),
  'Bogazici University', 'Istanbul', 601, 3500, 800, true
WHERE NOT EXISTS (
  SELECT 1 FROM universities u 
  WHERE u.name = 'Bogazici University' 
  AND u.country_id = (SELECT id FROM countries WHERE slug = 'tr')
);