
-- Teacher Sessions
CREATE TABLE public.teacher_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID NOT NULL,
  language_key TEXT NOT NULL DEFAULT 'russian',
  lesson_slug TEXT,
  module_slug TEXT,
  session_type TEXT NOT NULL DEFAULT 'lesson_delivery',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  zoom_link TEXT,
  summary TEXT,
  next_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session Students (with attendance built-in)
CREATE TABLE public.teacher_session_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.teacher_sessions(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL,
  attendance_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_user_id)
);

-- Session Notes / Outcomes
CREATE TABLE public.teacher_session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.teacher_sessions(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL,
  summary TEXT NOT NULL,
  next_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-Student Session Evaluations
CREATE TABLE public.teacher_student_session_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.teacher_sessions(id) ON DELETE CASCADE,
  teacher_user_id UUID NOT NULL,
  student_user_id UUID NOT NULL,
  language_key TEXT NOT NULL DEFAULT 'russian',
  lesson_slug TEXT,
  participation_score INTEGER,
  understanding_score INTEGER,
  confidence_score INTEGER,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  recommended_next_action TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_user_id)
);

-- RLS
ALTER TABLE public.teacher_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_session_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_student_session_evaluations ENABLE ROW LEVEL SECURITY;

-- Policies: service_role only (edge function handles auth)
CREATE POLICY "Service role full access" ON public.teacher_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.teacher_session_students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.teacher_session_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.teacher_student_session_evaluations FOR ALL USING (true) WITH CHECK (true);
