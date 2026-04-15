-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Remove old constraints/indexes
ALTER TABLE university_media_suggestions 
  DROP CONSTRAINT IF EXISTS unique_university_media_hash;
DROP INDEX IF EXISTS idx_university_media_hash_unique;

-- Fill image_url_hash for existing rows
UPDATE university_media_suggestions
SET image_url_hash = encode(
  extensions.digest(lower(regexp_replace(COALESCE(image_url, ''), '[?#].*$', '')), 'sha256'), 
  'hex'
)
WHERE image_url_hash IS NULL;

-- Delete rows with empty image_url (invalid data)
DELETE FROM university_media_suggestions 
WHERE image_url IS NULL OR image_url = '';

-- Use CTE to identify and keep only the newest row for each unique combination
WITH ranked_rows AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY university_id, media_type, image_url_hash 
           ORDER BY created_at DESC, id DESC
         ) as rn
  FROM university_media_suggestions
  WHERE image_url_hash IS NOT NULL
)
DELETE FROM university_media_suggestions
WHERE id IN (
  SELECT id FROM ranked_rows WHERE rn > 1
);

-- Now create the unique index
CREATE UNIQUE INDEX idx_university_media_hash_unique
  ON university_media_suggestions (university_id, media_type, image_url_hash)
  WHERE image_url_hash IS NOT NULL;