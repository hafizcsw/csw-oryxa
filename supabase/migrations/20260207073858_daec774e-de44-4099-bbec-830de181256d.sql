
-- Clean up garbage programs (Door: Cleanup)
-- Move programs with junk titles to quarantine
INSERT INTO program_quarantine (university_id, original_title, rejection_reason, extracted_json, source_url)
SELECT 
  university_id,
  title,
  CASE 
    WHEN title LIKE '%#%' THEN 'Contains hash character'
    WHEN title LIKE '%)%' THEN 'Contains closing parenthesis'
    WHEN title LIKE '%(%' THEN 'Contains opening parenthesis'
    ELSE 'Invalid title format'
  END,
  NULL,
  NULL
FROM programs
WHERE title LIKE '%#%' OR title LIKE '%)%' OR title LIKE '%(%'
ON CONFLICT DO NOTHING;

-- Delete garbage programs (safe: already in quarantine)
DELETE FROM programs
WHERE id IN (
  SELECT id FROM programs
  WHERE title LIKE '%#%' OR title LIKE '%)%' OR title LIKE '%(%'
);

-- Fix universities with city='NaN'
UPDATE universities
SET city = NULL
WHERE city = 'NaN';
