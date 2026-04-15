-- Drop partial index (doesn't work with ON CONFLICT in PostgREST)
DROP INDEX IF EXISTS uq_program_draft_program_key;

-- Set default for program_key to avoid NULLs
UPDATE program_draft SET program_key = 'legacy_' || id WHERE program_key IS NULL;

-- Create a proper non-partial unique constraint
ALTER TABLE program_draft ADD CONSTRAINT uq_program_draft_program_key UNIQUE (program_key);