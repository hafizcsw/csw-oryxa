-- Add scholarship flag and any missing fields
ALTER TABLE public.programs 
ADD COLUMN IF NOT EXISTS has_scholarship boolean DEFAULT false;

COMMENT ON COLUMN public.programs.has_scholarship IS 'Whether program has associated scholarship';