
-- Fix remaining bad city names in Egypt
-- MTI → Cairo, Nahda → Cairo, Nile → Giza, October 6 → 6th of October City
-- Sinai → Arish, South Valley → Qena

UPDATE universities SET city = 'Cairo' 
WHERE city = 'Mti' AND country_id = (SELECT id FROM countries WHERE country_code = 'EG');

UPDATE universities SET city = 'Cairo' 
WHERE city = 'Nahda' AND country_id = (SELECT id FROM countries WHERE country_code = 'EG');

UPDATE universities SET city = 'Giza' 
WHERE city = 'Nile' AND country_id = (SELECT id FROM countries WHERE country_code = 'EG');

UPDATE universities SET city = '6th of October City' 
WHERE city = 'October 6' AND country_id = (SELECT id FROM countries WHERE country_code = 'EG');

UPDATE universities SET city = 'Arish' 
WHERE city = 'Sinai' AND country_id = (SELECT id FROM countries WHERE country_code = 'EG');

UPDATE universities SET city = 'Qena' 
WHERE city = 'South Valley' AND country_id = (SELECT id FROM countries WHERE country_code = 'EG');

-- Add Helwan and Qena coordinates
INSERT INTO city_coordinates (city_name, country_code, lat, lon) VALUES
  ('Helwan', 'EG', 29.85, 31.33),
  ('Qena', 'EG', 26.16, 32.73)
ON CONFLICT (city_name, country_code) DO NOTHING;
