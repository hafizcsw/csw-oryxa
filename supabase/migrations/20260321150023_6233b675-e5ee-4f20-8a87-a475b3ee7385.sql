
ALTER TABLE public.learning_assignments
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS submission_notes text,
  ADD COLUMN IF NOT EXISTS submission_file_url text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE public.learning_exam_notices
  ADD COLUMN IF NOT EXISTS external_link text;
