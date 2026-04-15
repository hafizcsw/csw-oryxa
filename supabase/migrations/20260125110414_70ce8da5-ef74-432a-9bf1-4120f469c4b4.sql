-- Add admission requirements columns to programs table (additive only)
ALTER TABLE public.programs 
ADD COLUMN IF NOT EXISTS ielts_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ielts_min_overall numeric(2,1),
ADD COLUMN IF NOT EXISTS ielts_min_each_section numeric(2,1),
ADD COLUMN IF NOT EXISTS toefl_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS toefl_min integer,
ADD COLUMN IF NOT EXISTS gpa_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS gpa_min numeric(3,2),
ADD COLUMN IF NOT EXISTS prep_year_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS interview_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS required_documents jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS additional_requirements text;

-- Add comments for documentation
COMMENT ON COLUMN public.programs.ielts_required IS 'Whether IELTS is required for admission';
COMMENT ON COLUMN public.programs.ielts_min_overall IS 'Minimum IELTS overall score (e.g., 6.5)';
COMMENT ON COLUMN public.programs.ielts_min_each_section IS 'Minimum IELTS score for each section';
COMMENT ON COLUMN public.programs.toefl_required IS 'Whether TOEFL is required for admission';
COMMENT ON COLUMN public.programs.toefl_min IS 'Minimum TOEFL score';
COMMENT ON COLUMN public.programs.gpa_required IS 'Whether minimum GPA is required';
COMMENT ON COLUMN public.programs.gpa_min IS 'Minimum GPA (e.g., 2.50)';
COMMENT ON COLUMN public.programs.prep_year_required IS 'Whether preparatory year is required';
COMMENT ON COLUMN public.programs.interview_required IS 'Whether interview is required';
COMMENT ON COLUMN public.programs.required_documents IS 'JSON array of required document types';
COMMENT ON COLUMN public.programs.additional_requirements IS 'Additional requirements text';