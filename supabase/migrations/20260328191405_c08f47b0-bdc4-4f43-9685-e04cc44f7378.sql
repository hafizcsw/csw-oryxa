
ALTER TABLE public.teacher_sessions
  ADD COLUMN IF NOT EXISTS teacher_type text DEFAULT 'language_teacher',
  ADD COLUMN IF NOT EXISTS curriculum_course_id text,
  ADD COLUMN IF NOT EXISTS curriculum_module_id text,
  ADD COLUMN IF NOT EXISTS curriculum_lesson_id text;
