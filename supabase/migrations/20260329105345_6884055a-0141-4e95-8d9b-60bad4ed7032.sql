
-- Phase 3: Student lesson progression — teacher-controlled
-- This table is the canonical source of truth for which lessons are released/locked per student

CREATE TABLE IF NOT EXISTS public.student_lesson_progression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  course_key text NOT NULL DEFAULT 'russian',
  lesson_slug text NOT NULL,
  module_slug text,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'in_progress', 'completed', 'review_required')),
  released_by uuid,
  released_at timestamptz,
  completed_at timestamptz,
  teacher_notes text,
  mastery_score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, course_key, lesson_slug)
);

-- Index for fast student queries
CREATE INDEX idx_slp_student_course ON public.student_lesson_progression(student_user_id, course_key);
CREATE INDEX idx_slp_released_by ON public.student_lesson_progression(released_by);

-- RLS
ALTER TABLE public.student_lesson_progression ENABLE ROW LEVEL SECURITY;

-- Students can read their own progression
CREATE POLICY "Students can read own progression"
  ON public.student_lesson_progression FOR SELECT
  TO authenticated
  USING (student_user_id = auth.uid());

-- Teachers can read/write progression for their students (via session relationship)
CREATE POLICY "Teachers can manage student progression"
  ON public.student_lesson_progression FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_session_students tss
      JOIN public.teacher_sessions ts ON ts.id = tss.session_id
      WHERE tss.student_user_id = student_lesson_progression.student_user_id
        AND ts.teacher_user_id = auth.uid()
    )
  );

-- Phase 3: Current lesson pointer per student/course
CREATE TABLE IF NOT EXISTS public.student_course_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  course_key text NOT NULL DEFAULT 'russian',
  current_lesson_slug text,
  current_module_slug text,
  progression_status text NOT NULL DEFAULT 'active' CHECK (progression_status IN ('active', 'paused', 'completed', 'review_hold')),
  next_teacher_decision text,
  last_teacher_action_at timestamptz,
  last_student_activity_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, course_key)
);

ALTER TABLE public.student_course_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own course state"
  ON public.student_course_state FOR SELECT
  TO authenticated
  USING (student_user_id = auth.uid());

CREATE POLICY "Teachers can manage student course state"
  ON public.student_course_state FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teacher_session_students tss
      JOIN public.teacher_sessions ts ON ts.id = tss.session_id
      WHERE tss.student_user_id = student_course_state.student_user_id
        AND ts.teacher_user_id = auth.uid()
    )
  );

-- Enable realtime for progression updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_lesson_progression;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_course_state;
