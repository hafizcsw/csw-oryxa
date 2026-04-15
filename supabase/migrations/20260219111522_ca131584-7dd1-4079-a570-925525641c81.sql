
-- Add unique constraint needed for Bridge upsert idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_program_urls_uni_kind_canonical 
ON program_urls (university_id, kind, canonical_url);
