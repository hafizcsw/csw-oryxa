-- First, update existing rows to match new constraint
UPDATE university_media_suggestions
SET source = CASE 
  WHEN source = 'ai_generated' THEN 'ai_generation'
  WHEN source = 'web_search' THEN 'web_search'
  ELSE 'web_search'
END
WHERE source NOT IN ('web_search', 'web_search_ai', 'ai_generation');

-- Add new columns for AI validation metadata
ALTER TABLE university_media_suggestions 
  ADD COLUMN IF NOT EXISTS image_url_hash text,
  ADD COLUMN IF NOT EXISTS ai_validated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_confidence int,
  ADD COLUMN IF NOT EXISTS ai_reasoning text,
  ADD COLUMN IF NOT EXISTS ai_detected_content text,
  ADD COLUMN IF NOT EXISTS ai_recommendation text,
  ADD COLUMN IF NOT EXISTS ai_model text,
  ADD COLUMN IF NOT EXISTS ai_provider text DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS ai_latency_ms int;

-- Update source column constraint to include new values
ALTER TABLE university_media_suggestions 
  DROP CONSTRAINT IF EXISTS university_media_suggestions_source_check;
  
ALTER TABLE university_media_suggestions 
  ADD CONSTRAINT university_media_suggestions_source_check 
  CHECK (source IN ('web_search','web_search_ai','ai_generation'));

-- Create partial unique index (only for non-null hashes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_university_media_hash_unique
  ON university_media_suggestions(university_id, media_type, image_url_hash)
  WHERE image_url_hash IS NOT NULL;

-- Add index for faster queries on validated images
CREATE INDEX IF NOT EXISTS idx_media_suggestions_validated 
  ON university_media_suggestions(university_id, media_type, ai_validated, ai_confidence);