-- Add missing columns to university_comments
ALTER TABLE public.university_comments
ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id),
ADD COLUMN IF NOT EXISTS reply_as_university BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient comment queries by university
CREATE INDEX IF NOT EXISTS idx_university_comments_university_id ON public.university_comments(university_id);
