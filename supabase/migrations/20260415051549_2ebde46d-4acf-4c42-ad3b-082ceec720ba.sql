
-- ============================================================
-- FIX 1: application_status_events — restrict public read
-- ============================================================

-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "ase_public_read" ON public.application_status_events;

-- Allow only the application owner to read status events
CREATE POLICY "Owner can read application status events"
ON public.application_status_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = application_status_events.application_id
    AND a.user_id = auth.uid()
  )
);

-- ============================================================
-- FIX 2: Russian learning tables — enable RLS + user policies
-- ============================================================

-- russian_assessment_attempts
ALTER TABLE public.russian_assessment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assessment attempts"
ON public.russian_assessment_attempts FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessment attempts"
ON public.russian_assessment_attempts FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assessment attempts"
ON public.russian_assessment_attempts FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assessment attempts"
ON public.russian_assessment_attempts FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- russian_exam_attempts
ALTER TABLE public.russian_exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exam attempts"
ON public.russian_exam_attempts FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exam attempts"
ON public.russian_exam_attempts FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exam attempts"
ON public.russian_exam_attempts FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own exam attempts"
ON public.russian_exam_attempts FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- russian_learner_readiness_profiles
ALTER TABLE public.russian_learner_readiness_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own readiness profiles"
ON public.russian_learner_readiness_profiles FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own readiness profiles"
ON public.russian_learner_readiness_profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own readiness profiles"
ON public.russian_learner_readiness_profiles FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own readiness profiles"
ON public.russian_learner_readiness_profiles FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- russian_placement_results
ALTER TABLE public.russian_placement_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own placement results"
ON public.russian_placement_results FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own placement results"
ON public.russian_placement_results FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own placement results"
ON public.russian_placement_results FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own placement results"
ON public.russian_placement_results FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- russian_learner_unlocks
ALTER TABLE public.russian_learner_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learner unlocks"
ON public.russian_learner_unlocks FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learner unlocks"
ON public.russian_learner_unlocks FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learner unlocks"
ON public.russian_learner_unlocks FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own learner unlocks"
ON public.russian_learner_unlocks FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- FIX 3: Teacher tables — fix role from public to service_role
-- ============================================================

-- teacher_plans
DROP POLICY IF EXISTS "Service role full access teacher_plans" ON public.teacher_plans;
CREATE POLICY "Service role full access teacher_plans"
ON public.teacher_plans FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- teacher_exam_modes
DROP POLICY IF EXISTS "Service role full access teacher_exam_modes" ON public.teacher_exam_modes;
CREATE POLICY "Service role full access teacher_exam_modes"
ON public.teacher_exam_modes FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- teacher_review_items
DROP POLICY IF EXISTS "Service role full access teacher_review_items" ON public.teacher_review_items;
CREATE POLICY "Service role full access teacher_review_items"
ON public.teacher_review_items FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- teacher_ai_followups
DROP POLICY IF EXISTS "Service role full access teacher_ai_followups" ON public.teacher_ai_followups;
CREATE POLICY "Service role full access teacher_ai_followups"
ON public.teacher_ai_followups FOR ALL
TO service_role
USING (true) WITH CHECK (true);
