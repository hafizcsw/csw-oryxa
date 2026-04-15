-- Add CWUR ranking columns to universities table
ALTER TABLE public.universities
ADD COLUMN IF NOT EXISTS cwur_world_rank integer,
ADD COLUMN IF NOT EXISTS cwur_national_rank integer,
ADD COLUMN IF NOT EXISTS cwur_education_rank integer,
ADD COLUMN IF NOT EXISTS cwur_employability_rank integer,
ADD COLUMN IF NOT EXISTS cwur_faculty_rank integer,
ADD COLUMN IF NOT EXISTS cwur_research_rank integer,
ADD COLUMN IF NOT EXISTS cwur_score numeric,
ADD COLUMN IF NOT EXISTS cwur_profile_url text,
ADD COLUMN IF NOT EXISTS cwur_year integer;

-- Create index on world rank for faster sorting
CREATE INDEX IF NOT EXISTS idx_universities_cwur_world_rank ON public.universities(cwur_world_rank);

-- Add comment for documentation
COMMENT ON COLUMN public.universities.cwur_world_rank IS 'CWUR global ranking position';
COMMENT ON COLUMN public.universities.cwur_national_rank IS 'CWUR national ranking within country';
COMMENT ON COLUMN public.universities.cwur_education_rank IS 'CWUR education quality ranking';
COMMENT ON COLUMN public.universities.cwur_employability_rank IS 'CWUR employability ranking';
COMMENT ON COLUMN public.universities.cwur_faculty_rank IS 'CWUR faculty/academic staff ranking';
COMMENT ON COLUMN public.universities.cwur_research_rank IS 'CWUR research output ranking';
COMMENT ON COLUMN public.universities.cwur_score IS 'CWUR overall score';
COMMENT ON COLUMN public.universities.cwur_profile_url IS 'Link to university page on CWUR';
COMMENT ON COLUMN public.universities.cwur_year IS 'Year of CWUR ranking (e.g. 2025)';