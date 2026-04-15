-- Add display_name column to store the university name as seen on the source index page
ALTER TABLE public.university_external_ids
ADD COLUMN IF NOT EXISTS display_name text;

COMMENT ON COLUMN public.university_external_ids.display_name IS 'University display name as scraped from the source index page (e.g. studyinrussia.ru)';