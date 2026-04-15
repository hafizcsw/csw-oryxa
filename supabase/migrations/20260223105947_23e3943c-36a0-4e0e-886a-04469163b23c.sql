-- program_key is the natural key (sir_{sirId}_{sirProgramId}) - create non-partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_program_draft_program_key 
ON public.program_draft (program_key) 
WHERE program_key IS NOT NULL;

-- Drop the partial content_hash index since it doesn't work with ON CONFLICT
DROP INDEX IF EXISTS uq_program_draft_content_hash;