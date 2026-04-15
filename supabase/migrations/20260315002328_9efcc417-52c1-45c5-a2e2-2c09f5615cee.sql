
-- Delete duplicate universities (same base name, same ranking) where the duplicate has no country_id
DELETE FROM universities
WHERE id IN (
  SELECT b.id
  FROM universities a 
  JOIN universities b ON a.ranking = b.ranking AND a.id != b.id
  WHERE a.ranking IS NOT NULL 
    AND lower(trim(split_part(a.name, '(', 1))) = lower(trim(split_part(b.name, '(', 1)))
    AND a.country_id IS NOT NULL 
    AND b.country_id IS NULL
);
