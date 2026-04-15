-- Teacher ops closure: exam orchestration + AI follow-up + intervention timeline

CREATE TABLE IF NOT EXISTS public.teacher_exam_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID NOT NULL,
  student_user_id UUID NOT NULL,
  language_key TEXT NOT NULL DEFAULT 'russian',
  exam_target TEXT,
  exam_date DATE,
  countdown_days INT,
  required_sessions_per_week INT NOT NULL DEFAULT 5,
  daily_target_sessions INT NOT NULL DEFAULT 1,
  emergency_catchup_enabled BOOLEAN NOT NULL DEFAULT false,
  mock_readiness_score NUMERIC,
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  daily_targets JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_user_id, student_user_id, language_key)
);

CREATE TABLE IF NOT EXISTS public.teacher_ai_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID NOT NULL,
  student_user_id UUID NOT NULL,
  language_key TEXT NOT NULL DEFAULT 'russian',
  lesson_slug TEXT,
  module_slug TEXT,
  recap_used BOOLEAN NOT NULL DEFAULT false,
  student_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  confusion_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_mistakes JSONB NOT NULL DEFAULT '[]'::jsonb,
  practice_completion NUMERIC,
  escalation_requested BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_exam_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_ai_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access teacher_exam_modes" ON public.teacher_exam_modes;
CREATE POLICY "Service role full access teacher_exam_modes"
ON public.teacher_exam_modes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access teacher_ai_followups" ON public.teacher_ai_followups;
CREATE POLICY "Service role full access teacher_ai_followups"
ON public.teacher_ai_followups FOR ALL USING (true) WITH CHECK (true);
