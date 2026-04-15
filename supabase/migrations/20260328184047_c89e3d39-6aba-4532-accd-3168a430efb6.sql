
ALTER TABLE public.teacher_public_profiles 
  ADD COLUMN IF NOT EXISTS teaches_subject text DEFAULT 'Russian',
  ADD COLUMN IF NOT EXISTS response_time text DEFAULT '1h',
  ADD COLUMN IF NOT EXISTS badges text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS reviews_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS students_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lessons_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booked_recently integer DEFAULT 0;
