
-- Teacher notes table for staff to annotate students
CREATE TABLE public.teacher_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID NOT NULL,
  student_user_id UUID NOT NULL,
  language_key TEXT NOT NULL DEFAULT 'russian',
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_teacher_notes_student ON public.teacher_notes(student_user_id, language_key);
CREATE INDEX idx_teacher_notes_teacher ON public.teacher_notes(teacher_user_id);

-- Enable RLS
ALTER TABLE public.teacher_notes ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can interact (actual auth check happens in edge function)
CREATE POLICY "Authenticated users can read teacher notes"
  ON public.teacher_notes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert teacher notes"
  ON public.teacher_notes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update own teacher notes"
  ON public.teacher_notes FOR UPDATE TO authenticated
  USING (teacher_user_id = auth.uid());
