-- Priority 2: University profile enrichment columns
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS founded_year smallint,
  ADD COLUMN IF NOT EXISTS student_count integer,
  ADD COLUMN IF NOT EXISTS intl_student_count integer,
  ADD COLUMN IF NOT EXISTS faculty_count integer,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS rector_name text,
  ADD COLUMN IF NOT EXISTS rector_title text,
  ADD COLUMN IF NOT EXISTS rector_image_url text,
  ADD COLUMN IF NOT EXISTS rector_message text;

COMMENT ON COLUMN public.universities.founded_year IS 'Year the university was established';
COMMENT ON COLUMN public.universities.student_count IS 'Total enrolled students';
COMMENT ON COLUMN public.universities.intl_student_count IS 'International student count';
COMMENT ON COLUMN public.universities.faculty_count IS 'Number of faculty/academic staff';
COMMENT ON COLUMN public.universities.address IS 'Main campus postal address';
COMMENT ON COLUMN public.universities.rector_name IS 'Current rector/president/director name';
COMMENT ON COLUMN public.universities.rector_title IS 'Leadership title (Rector, President, Director, etc.)';
COMMENT ON COLUMN public.universities.rector_image_url IS 'URL to leadership portrait photo';
COMMENT ON COLUMN public.universities.rector_message IS 'Official leadership message or welcome text';