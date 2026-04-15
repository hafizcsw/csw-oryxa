
-- Add QS ranking columns to universities
ALTER TABLE universities ADD COLUMN IF NOT EXISTS qs_world_rank integer;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS qs_overall_score numeric;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS qs_regional_rank integer;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS qs_sustainability_rank integer;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS qs_ranking_year integer;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS qs_indicators jsonb;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS qs_subject_rankings jsonb;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS about_text text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS institution_type text;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS social_links jsonb;

-- Add subject_area and deadline columns to programs
ALTER TABLE programs ADD COLUMN IF NOT EXISTS subject_area text;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS deadlines jsonb;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS admission_requirements_json jsonb;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS tuition_domestic numeric;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS school_name text;
