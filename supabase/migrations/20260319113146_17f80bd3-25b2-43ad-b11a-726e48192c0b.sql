-- Priority 3: Program-level media support via nullable FK on university_media
-- This is the narrowest correct option: reuse existing table, add optional program scope
ALTER TABLE public.university_media
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_university_media_program_id 
  ON public.university_media(program_id) WHERE program_id IS NOT NULL;

COMMENT ON COLUMN public.university_media.program_id IS 'Optional program FK — when set, media belongs to this program specifically rather than university-wide';