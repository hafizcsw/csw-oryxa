-- Final cleanup: Remove all remaining duplicate countries

-- Merge Japan (jp → japan)
UPDATE universities 
SET country_id = (SELECT id FROM countries WHERE slug = 'japan' AND name = 'Japan' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'jp');

UPDATE education_events 
SET country_id = (SELECT id FROM countries WHERE slug = 'japan' AND name = 'Japan' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'jp');

-- Delete Japan (jp)
DELETE FROM countries WHERE slug = 'jp';

-- Now let's check if there are more duplicates we need to handle
-- Check Canada: we have both "Canada" (ca) and "كندا" (canada)
-- Keep the English one (ca) and merge
UPDATE universities 
SET country_id = (SELECT id FROM countries WHERE slug = 'ca' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'canada');

UPDATE education_events 
SET country_id = (SELECT id FROM countries WHERE slug = 'ca' LIMIT 1)
WHERE country_id IN (SELECT id FROM countries WHERE slug = 'canada');

UPDATE applications 
SET country_slug = 'ca'
WHERE country_slug = 'canada';

DELETE FROM countries WHERE slug = 'canada';