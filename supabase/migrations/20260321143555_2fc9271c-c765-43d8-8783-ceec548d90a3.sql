
-- Learning enrollments: one per student per language/path
CREATE TABLE public.learning_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  language TEXT NOT NULL DEFAULT 'russian',
  path_key TEXT NOT NULL DEFAULT 'russian_prep',
  goal TEXT,
  timeline TEXT,
  level_mode TEXT,
  daily_minutes INT DEFAULT 30,
  placement_result TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_enrollments ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_learning_enrollments_user_lang ON public.learning_enrollments(user_id, language);

CREATE POLICY "Users can read own enrollments" ON public.learning_enrollments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enrollments" ON public.learning_enrollments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own enrollments" ON public.learning_enrollments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Lesson progress
CREATE TABLE public.learning_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  enrollment_id UUID REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
  lesson_slug TEXT NOT NULL,
  module_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_lesson_progress_user_lesson ON public.learning_lesson_progress(user_id, lesson_slug);

CREATE POLICY "Users can read own lesson progress" ON public.learning_lesson_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lesson progress" ON public.learning_lesson_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lesson progress" ON public.learning_lesson_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Vocabulary progress
CREATE TABLE public.learning_vocab_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  word_ru TEXT NOT NULL,
  word_meaning TEXT NOT NULL,
  transliteration TEXT,
  lesson_slug TEXT,
  module_slug TEXT,
  mastery TEXT NOT NULL DEFAULT 'new',
  review_count INT DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_vocab_progress ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_vocab_progress_user_word ON public.learning_vocab_progress(user_id, word_ru);

CREATE POLICY "Users can read own vocab" ON public.learning_vocab_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocab" ON public.learning_vocab_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vocab" ON public.learning_vocab_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Study sessions
CREATE TABLE public.learning_study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  enrollment_id UUID REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
  lesson_slug TEXT,
  module_slug TEXT,
  event_type TEXT NOT NULL,
  duration_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions" ON public.learning_study_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON public.learning_study_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Assignments
CREATE TABLE public.learning_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  enrollment_id UUID REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  module_slug TEXT,
  lesson_slug TEXT,
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'new',
  submission_text TEXT,
  submission_file_path TEXT,
  submitted_at TIMESTAMPTZ,
  feedback TEXT,
  score NUMERIC,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own assignments" ON public.learning_assignments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own assignments" ON public.learning_assignments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Exam notices
CREATE TABLE public.learning_exam_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  enrollment_id UUID REFERENCES public.learning_enrollments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  exam_type TEXT NOT NULL DEFAULT 'practice',
  description TEXT,
  module_coverage TEXT[],
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'upcoming',
  preparation_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_exam_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own exams" ON public.learning_exam_notices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Placement results
CREATE TABLE public.learning_placement_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  language TEXT NOT NULL DEFAULT 'russian',
  score INT,
  total_questions INT,
  result_category TEXT NOT NULL,
  answers JSONB,
  completed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_placement_results ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_placement_user_lang ON public.learning_placement_results(user_id, language);

CREATE POLICY "Users can read own placement" ON public.learning_placement_results
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own placement" ON public.learning_placement_results
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
