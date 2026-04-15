-- Russian Section — Execution Pack 1 runtime closure
-- Add checkpoint/exam unlock targets so runtime gating can be persisted safely before first live apply.

ALTER TABLE public.russian_learner_unlocks
  ADD COLUMN IF NOT EXISTS assessment_template_id UUID,
  ADD COLUMN IF NOT EXISTS exam_set_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'learner_unlocks_assessment_template_id_fkey'
      AND conrelid = 'public.russian_learner_unlocks'::regclass
  ) THEN
    ALTER TABLE public.russian_learner_unlocks
      ADD CONSTRAINT learner_unlocks_assessment_template_id_fkey
      FOREIGN KEY (assessment_template_id) REFERENCES public.russian_assessment_templates(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'learner_unlocks_exam_set_id_fkey'
      AND conrelid = 'public.russian_learner_unlocks'::regclass
  ) THEN
    ALTER TABLE public.russian_learner_unlocks
      ADD CONSTRAINT learner_unlocks_exam_set_id_fkey
      FOREIGN KEY (exam_set_id) REFERENCES public.russian_exam_sets(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_learner_unlocks_unique_module;
DROP INDEX IF EXISTS idx_learner_unlocks_unique_lesson;

CREATE UNIQUE INDEX IF NOT EXISTS idx_learner_unlocks_unique_module
  ON public.russian_learner_unlocks(user_id, course_id, module_id, unlock_type)
  WHERE module_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_learner_unlocks_unique_lesson
  ON public.russian_learner_unlocks(user_id, course_id, lesson_id, unlock_type)
  WHERE lesson_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_learner_unlocks_unique_checkpoint
  ON public.russian_learner_unlocks(user_id, course_id, assessment_template_id, unlock_type)
  WHERE assessment_template_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_learner_unlocks_unique_exam_set
  ON public.russian_learner_unlocks(user_id, course_id, exam_set_id, unlock_type)
  WHERE exam_set_id IS NOT NULL;

ALTER TABLE public.russian_learner_unlocks
  DROP CONSTRAINT IF EXISTS learner_unlocks_target_check,
  ADD CONSTRAINT learner_unlocks_target_check CHECK (
    num_nonnulls(module_id, lesson_id, assessment_template_id, exam_set_id) = 1
  );
