CREATE TABLE IF NOT EXISTS public.russian_intensive_review_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.russian_learning_courses(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  source_exam_key TEXT NOT NULL,
  source_exam_attempt_id UUID REFERENCES public.russian_exam_attempts(id) ON DELETE SET NULL,
  review_status TEXT NOT NULL DEFAULT 'active',
  review_block_ids TEXT[] NOT NULL DEFAULT '{}',
  blocking_reasons TEXT[] NOT NULL DEFAULT '{}',
  weak_area_keys TEXT[] NOT NULL DEFAULT '{}',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT russian_intensive_review_states_status_check CHECK (review_status IN ('active', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_russian_intensive_review_states_user_course
  ON public.russian_intensive_review_states(user_id, course_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_russian_intensive_review_states_source_unique
  ON public.russian_intensive_review_states(user_id, course_id, source_exam_key);

ALTER TABLE public.russian_intensive_review_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own russian intensive review states" ON public.russian_intensive_review_states;
CREATE POLICY "Users can read own russian intensive review states"
  ON public.russian_intensive_review_states
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own russian intensive review states" ON public.russian_intensive_review_states;
CREATE POLICY "Users can insert own russian intensive review states"
  ON public.russian_intensive_review_states
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own russian intensive review states" ON public.russian_intensive_review_states;
CREATE POLICY "Users can update own russian intensive review states"
  ON public.russian_intensive_review_states
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
