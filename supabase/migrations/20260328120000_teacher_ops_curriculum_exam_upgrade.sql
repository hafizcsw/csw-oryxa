-- Teacher operating system upgrade: curriculum references, teacher type, planning and review queues

ALTER TABLE public.teacher_sessions
  ADD COLUMN IF NOT EXISTS teacher_type TEXT NOT NULL DEFAULT 'language_teacher',
  ADD COLUMN IF NOT EXISTS curriculum_course_id UUID REFERENCES public.russian_learning_courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curriculum_module_id UUID REFERENCES public.russian_learning_modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curriculum_lesson_id UUID REFERENCES public.russian_learning_lessons(id) ON DELETE SET NULL;

ALTER TABLE public.teacher_sessions
  DROP CONSTRAINT IF EXISTS teacher_sessions_teacher_type_check;

ALTER TABLE public.teacher_sessions
  ADD CONSTRAINT teacher_sessions_teacher_type_check
  CHECK (teacher_type IN ('language_teacher', 'curriculum_exam_teacher'));

CREATE TABLE IF NOT EXISTS public.teacher_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID NOT NULL,
  student_user_id UUID NOT NULL,
  language_key TEXT NOT NULL DEFAULT 'russian',
  teacher_type TEXT NOT NULL DEFAULT 'language_teacher',
  plan_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  title TEXT NOT NULL,
  target_lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
  homework_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  checkpoint_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT teacher_plans_type_check CHECK (plan_type IN ('weekly_plan', 'monthly_plan', 'intensive_plan', 'exam_sprint_plan', 'catch_up_plan', 'custom_plan')),
  CONSTRAINT teacher_plans_teacher_type_check CHECK (teacher_type IN ('language_teacher', 'curriculum_exam_teacher'))
);

CREATE INDEX IF NOT EXISTS idx_teacher_plans_teacher_student ON public.teacher_plans(teacher_user_id, student_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.teacher_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID NOT NULL,
  student_user_id UUID,
  session_id UUID REFERENCES public.teacher_sessions(id) ON DELETE SET NULL,
  lesson_slug TEXT,
  module_slug TEXT,
  queue_type TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'medium',
  reason TEXT NOT NULL,
  recommended_next_action TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  outreach_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_action JSONB,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT teacher_review_items_queue_type_check CHECK (queue_type IN ('pending_reviews', 'follow_up', 'missed_sessions', 'inactive_students', 'unresolved_outcomes', 'overdue_tasks', 'checkpoint_failures', 'ai_escalations')),
  CONSTRAINT teacher_review_items_urgency_check CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT teacher_review_items_status_check CHECK (status IN ('open', 'in_progress', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_teacher_review_items_owner_status ON public.teacher_review_items(teacher_user_id, status, urgency, created_at DESC);

ALTER TABLE public.teacher_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access teacher_plans" ON public.teacher_plans;
CREATE POLICY "Service role full access teacher_plans"
ON public.teacher_plans FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access teacher_review_items" ON public.teacher_review_items;
CREATE POLICY "Service role full access teacher_review_items"
ON public.teacher_review_items FOR ALL USING (true) WITH CHECK (true);
