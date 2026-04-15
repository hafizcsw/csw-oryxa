
-- Door 2: Fix schema issues + provenance
ALTER TABLE source_evidence 
ADD COLUMN IF NOT EXISTS field_source TEXT,
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS captured_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS extraction_error TEXT;

-- Door 3: Add uniranks_slug to universities (already done, verify index)
ALTER TABLE universities
ADD COLUMN IF NOT EXISTS uniranks_slug TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_universities_uniranks_slug 
ON universities(uniranks_slug) WHERE uniranks_slug IS NOT NULL;

-- Door 7: Add unique index on fingerprint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_program_draft_fingerprint_university
ON program_draft(university_id, fingerprint) 
WHERE fingerprint IS NOT NULL AND university_id IS NOT NULL;

-- Cleanup: Quarantine table for rejected programs
CREATE TABLE IF NOT EXISTS program_quarantine (
  id BIGSERIAL PRIMARY KEY,
  university_id UUID NOT NULL,
  original_title TEXT NOT NULL,
  rejection_reason TEXT NOT NULL,
  extracted_json JSONB,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Door 3: Ensure uniranks_slug is mandatory for enrichment tracking
ALTER TABLE universities
ADD CONSTRAINT check_uniranks_slug_not_empty 
CHECK (uniranks_slug IS NULL OR length(uniranks_slug) > 0);
