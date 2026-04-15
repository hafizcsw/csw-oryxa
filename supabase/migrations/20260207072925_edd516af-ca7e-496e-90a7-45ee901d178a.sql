-- Add uniranks_slug column for university idempotency
ALTER TABLE universities 
ADD COLUMN IF NOT EXISTS uniranks_slug TEXT;

-- Create unique index for uniranks_slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_universities_uniranks_slug 
ON universities(uniranks_slug) WHERE uniranks_slug IS NOT NULL;

-- Add fingerprint column to program_draft if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'program_draft' AND column_name = 'fingerprint'
  ) THEN
    ALTER TABLE program_draft ADD COLUMN fingerprint TEXT;
  END IF;
END $$;

-- Create unique index for program_draft fingerprint
CREATE UNIQUE INDEX IF NOT EXISTS idx_program_draft_fingerprint 
ON program_draft(fingerprint) WHERE fingerprint IS NOT NULL;