-- Step 1: Merge duplicate countries - Update all references first

-- Update universities from "Germany" (de) to "ألمانيا" (germany)
UPDATE universities 
SET country_id = (SELECT id FROM countries WHERE slug = 'germany' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'de');

-- Update universities from "Russia" (ru) to "روسيا" (russia)
UPDATE universities 
SET country_id = (SELECT id FROM countries WHERE slug = 'russia' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'ru');

-- Update universities from "Netherlands" (nl) to "هولندا" (netherlands)
UPDATE universities 
SET country_id = (SELECT id FROM countries WHERE slug = 'netherlands' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'nl');

-- Update universities from "بريطانيا" (united-kingdom) to "United Kingdom" (uk)
UPDATE universities 
SET country_id = (SELECT id FROM countries WHERE slug = 'uk' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'united-kingdom');

-- Step 2: Update education_events references
UPDATE education_events 
SET country_id = (SELECT id FROM countries WHERE slug = 'germany' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'de');

UPDATE education_events 
SET country_id = (SELECT id FROM countries WHERE slug = 'russia' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'ru');

UPDATE education_events 
SET country_id = (SELECT id FROM countries WHERE slug = 'netherlands' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'nl');

UPDATE education_events 
SET country_id = (SELECT id FROM countries WHERE slug = 'uk' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'united-kingdom');

-- Step 3: Update applications table
UPDATE applications 
SET country_slug = 'germany'
WHERE country_slug = 'de';

UPDATE applications 
SET country_slug = 'russia'
WHERE country_slug = 'ru';

UPDATE applications 
SET country_slug = 'netherlands'
WHERE country_slug = 'nl';

UPDATE applications 
SET country_slug = 'uk'
WHERE country_slug = 'united-kingdom';

-- Step 4: Delete duplicate country entries
DELETE FROM countries WHERE slug IN ('de', 'ru', 'nl', 'united-kingdom');