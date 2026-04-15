-- Add unique index on content_hash for idempotent program_draft upserts
CREATE UNIQUE INDEX IF NOT EXISTS uq_program_draft_content_hash 
ON public.program_draft (content_hash) 
WHERE content_hash IS NOT NULL;