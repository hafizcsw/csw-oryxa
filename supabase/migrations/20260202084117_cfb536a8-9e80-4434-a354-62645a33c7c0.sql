-- Add new columns for country statistics
ALTER TABLE public.countries 
ADD COLUMN IF NOT EXISTS education_rank_global INTEGER,
ADD COLUMN IF NOT EXISTS international_students INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN public.countries.education_rank_global IS 'Global education ranking of the country';
COMMENT ON COLUMN public.countries.international_students IS 'Number of international students in the country';