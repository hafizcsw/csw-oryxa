
-- ============================================================
-- City Backfill: Extract cities from university names
-- Uses pattern matching on well-known university naming conventions
-- ============================================================

-- 1. "University of <City>" pattern (most common)
UPDATE universities SET city = extracted.city_name
FROM (
  SELECT id, 
    regexp_replace(
      regexp_replace(name, '^.*University [Oo]f\s+', ''),
      '\s*[-–,\(].*$', ''
    ) as city_name
  FROM universities
  WHERE (city IS NULL OR city = '' OR city = '__unknown__')
    AND country_code IS NOT NULL
    AND name ~* 'university of [A-Z]'
    AND name !~* 'university of (science|technology|applied|health|medicine|engineering|business|management|art|music|law|education|the|life|advanced|agriculture|economics|social|natural|information|computer|environmental|humanities|liberal|defense|nursing|pharmacy|veterinary|dental|medical|public|maritime|forestry|fisheries|mining|petroleum|textile|food|sport|physical|islamic|christian|buddhist|catholic)'
) extracted
WHERE universities.id = extracted.id
  AND length(extracted.city_name) BETWEEN 3 AND 50
  AND extracted.city_name !~* '^\d';

-- 2. "<City> University" pattern
UPDATE universities SET city = extracted.city_name
FROM (
  SELECT id,
    regexp_replace(
      regexp_replace(name, '\s+(University|Üniversitesi|Universiteit|Universität|Université|Universidad|Universidade|Università|Uniwersytet).*$', '', 'i'),
      '^(National|State|Federal|Royal|Imperial|Grand|Metropolitan|Municipal|Central|International)\s+', '', 'i'
    ) as city_name
  FROM universities
  WHERE (city IS NULL OR city = '' OR city = '__unknown__')
    AND country_code IS NOT NULL
    AND name ~* '(University|Üniversitesi|Universiteit|Universität|Université|Universidad|Universidade|Università)$'
) extracted
WHERE universities.id = extracted.id
  AND length(extracted.city_name) BETWEEN 3 AND 50
  AND extracted.city_name !~* '^\d'
  AND extracted.city_name !~* '^(Technical|Medical|Agricultural|Pedagogical|Polytechnic|Open|Virtual|Digital|Free|New|Old|Western|Eastern|Northern|Southern|Upper|Lower)$';

-- 3. Well-known US universities with known cities
UPDATE universities SET city = mapping.city
FROM (VALUES
  ('Massachusetts Institute of Technology', 'Cambridge'),
  ('Stanford University', 'Stanford'),
  ('Harvard University', 'Cambridge'),
  ('California Institute of Technology', 'Pasadena'),
  ('Princeton University', 'Princeton'),
  ('Yale University', 'New Haven'),
  ('Columbia University', 'New York'),
  ('Cornell University', 'Ithaca'),
  ('Duke University', 'Durham'),
  ('Georgetown University', 'Washington'),
  ('Brown University', 'Providence'),
  ('Dartmouth College', 'Hanover'),
  ('Rice University', 'Houston'),
  ('Emory University', 'Atlanta'),
  ('Vanderbilt University', 'Nashville'),
  ('Carnegie Mellon University', 'Pittsburgh'),
  ('Georgia Institute of Technology', 'Atlanta'),
  ('Purdue University', 'West Lafayette'),
  ('Penn State University', 'State College'),
  ('Rutgers University', 'New Brunswick'),
  ('Ohio State University', 'Columbus'),
  ('Michigan State University', 'East Lansing'),
  ('Texas A&M University', 'College Station'),
  ('Virginia Tech', 'Blacksburg'),
  ('Iowa State University', 'Ames')
) as mapping(uni_name, city)
WHERE universities.name ILIKE '%' || mapping.uni_name || '%'
  AND universities.country_code = 'US'
  AND (universities.city IS NULL OR universities.city = '' OR universities.city = '__unknown__');

-- 4. Well-known global universities
UPDATE universities SET city = mapping.city
FROM (VALUES
  ('ETH Zurich', 'Zurich', 'CH'),
  ('EPFL', 'Lausanne', 'CH'),
  ('Tsinghua University', 'Beijing', 'CN'),
  ('Peking University', 'Beijing', 'CN'),
  ('Fudan University', 'Shanghai', 'CN'),
  ('Zhejiang University', 'Hangzhou', 'CN'),
  ('Nanjing University', 'Nanjing', 'CN'),
  ('Wuhan University', 'Wuhan', 'CN'),
  ('IIT Bombay', 'Mumbai', 'IN'),
  ('IIT Delhi', 'New Delhi', 'IN'),
  ('IIT Madras', 'Chennai', 'IN'),
  ('IIT Kanpur', 'Kanpur', 'IN'),
  ('IIT Kharagpur', 'Kharagpur', 'IN'),
  ('Sorbonne University', 'Paris', 'FR'),
  ('Sciences Po', 'Paris', 'FR'),
  ('Technical University of Munich', 'Munich', 'DE'),
  ('Humboldt University of Berlin', 'Berlin', 'DE'),
  ('Free University of Berlin', 'Berlin', 'DE'),
  ('Ludwig Maximilian University of Munich', 'Munich', 'DE'),
  ('Heidelberg University', 'Heidelberg', 'DE'),
  ('RWTH Aachen University', 'Aachen', 'DE'),
  ('University of Tokyo', 'Tokyo', 'JP'),
  ('Kyoto University', 'Kyoto', 'JP'),
  ('Osaka University', 'Osaka', 'JP'),
  ('Tohoku University', 'Sendai', 'JP'),
  ('Seoul National University', 'Seoul', 'KR'),
  ('KAIST', 'Daejeon', 'KR'),
  ('Yonsei University', 'Seoul', 'KR'),
  ('Korea University', 'Seoul', 'KR'),
  ('Moscow State University', 'Moscow', 'RU'),
  ('Saint Petersburg State University', 'Saint Petersburg', 'RU'),
  ('Novosibirsk State University', 'Novosibirsk', 'RU'),
  ('National University of Singapore', 'Singapore', 'SG'),
  ('Nanyang Technological University', 'Singapore', 'SG'),
  ('University of São Paulo', 'São Paulo', 'BR'),
  ('University of Campinas', 'Campinas', 'BR'),
  ('UNAM', 'Mexico City', 'MX'),
  ('Tecnológico de Monterrey', 'Monterrey', 'MX'),
  ('University of Cape Town', 'Cape Town', 'ZA'),
  ('University of Witwatersrand', 'Johannesburg', 'ZA'),
  ('Cairo University', 'Cairo', 'EG'),
  ('American University in Cairo', 'Cairo', 'EG'),
  ('King Saud University', 'Riyadh', 'SA'),
  ('King Abdulaziz University', 'Jeddah', 'SA'),
  ('KAUST', 'Thuwal', 'SA'),
  ('United Arab Emirates University', 'Al Ain', 'AE'),
  ('Khalifa University', 'Abu Dhabi', 'AE'),
  ('University of Sharjah', 'Sharjah', 'AE'),
  ('Bilkent University', 'Ankara', 'TR'),
  ('Boğaziçi University', 'Istanbul', 'TR'),
  ('Koç University', 'Istanbul', 'TR'),
  ('Middle East Technical University', 'Ankara', 'TR'),
  ('University of Melbourne', 'Melbourne', 'AU'),
  ('University of Sydney', 'Sydney', 'AU'),
  ('Australian National University', 'Canberra', 'AU'),
  ('University of Queensland', 'Brisbane', 'AU'),
  ('Monash University', 'Melbourne', 'AU'),
  ('UNSW Sydney', 'Sydney', 'AU')
) as mapping(uni_name, city, cc)
WHERE universities.name ILIKE '%' || mapping.uni_name || '%'
  AND universities.country_code = mapping.cc
  AND (universities.city IS NULL OR universities.city = '' OR universities.city = '__unknown__');

-- 5. "University of <City>" pattern for TR (Üniversitesi)
UPDATE universities SET city = extracted.city_name
FROM (
  SELECT id,
    trim(regexp_replace(name, '\s+Üniversitesi.*$', '', 'i')) as city_name
  FROM universities
  WHERE (city IS NULL OR city = '' OR city = '__unknown__')
    AND country_code = 'TR'
    AND name ~* 'Üniversitesi$'
) extracted
WHERE universities.id = extracted.id
  AND length(extracted.city_name) BETWEEN 3 AND 40;

-- 6. Expand city_coordinates with major world cities not yet covered
INSERT INTO city_coordinates (city_name, country_code, lat, lon) 
SELECT v.city_name, v.country_code, v.lat, v.lon
FROM (VALUES
  ('Cambridge', 'US', 42.3736, -71.1097),
  ('Stanford', 'US', 37.4275, -122.1697),
  ('Pasadena', 'US', 34.1478, -118.1445),
  ('Princeton', 'US', 40.3573, -74.6672),
  ('New Haven', 'US', 41.3083, -72.9279),
  ('Ithaca', 'US', 42.4440, -76.5019),
  ('Durham', 'US', 35.9940, -78.8986),
  ('Providence', 'US', 41.8240, -71.4128),
  ('Nashville', 'US', 36.1627, -86.7816),
  ('Pittsburgh', 'US', 36.1627, -86.7816),
  ('West Lafayette', 'US', 40.4259, -86.9081),
  ('State College', 'US', 40.7934, -77.8600),
  ('New Brunswick', 'US', 40.4862, -74.4518),
  ('Columbus', 'US', 39.9612, -82.9988),
  ('East Lansing', 'US', 42.7369, -84.4839),
  ('College Station', 'US', 30.6280, -96.3344),
  ('Blacksburg', 'US', 37.2296, -80.4139),
  ('Ames', 'US', 42.0308, -93.6319),
  ('Thuwal', 'SA', 22.3097, 39.1044),
  ('Al Ain', 'AE', 24.1917, 55.7606),
  ('Campinas', 'BR', -22.9099, -47.0626),
  ('Monterrey', 'MX', 25.6866, -100.3161),
  ('Hangzhou', 'CN', 30.2741, 120.1551),
  ('Wuhan', 'CN', 30.5928, 114.3055),
  ('Nanjing', 'CN', 32.0603, 118.7969),
  ('Kanpur', 'IN', 26.4499, 80.3319),
  ('Kharagpur', 'IN', 22.3460, 87.2320),
  ('Daejeon', 'KR', 36.3504, 127.3845),
  ('Novosibirsk', 'RU', 55.0084, 82.9357),
  ('Sendai', 'JP', 38.2682, 140.8694),
  ('Lausanne', 'CH', 46.5197, 6.6323),
  ('Aachen', 'DE', 50.7753, 6.0839),
  ('Heidelberg', 'DE', 49.3988, 8.6724),
  ('Cape Town', 'ZA', -33.9249, 18.4241),
  ('Johannesburg', 'ZA', -26.2041, 28.0473),
  ('Brisbane', 'AU', -27.4698, 153.0251),
  ('Canberra', 'AU', -35.2809, 149.1300)
) as v(city_name, country_code, lat, lon)
WHERE NOT EXISTS (
  SELECT 1 FROM city_coordinates cc 
  WHERE cc.city_name = v.city_name AND cc.country_code = v.country_code
);
