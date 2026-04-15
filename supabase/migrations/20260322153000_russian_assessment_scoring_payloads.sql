ALTER TABLE public.russian_assessment_attempts
  ADD COLUMN IF NOT EXISTS section_scores_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.russian_exam_attempts
  ADD COLUMN IF NOT EXISTS feedback_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.russian_assessment_attempts
SET section_scores_json = COALESCE(section_scores_json, dimension_scores_json, '[]'::jsonb)
WHERE section_scores_json = '[]'::jsonb
  AND dimension_scores_json <> '[]'::jsonb;

UPDATE public.russian_exam_attempts
SET feedback_json = COALESCE(feedback_json, review_json, '{}'::jsonb)
WHERE feedback_json = '{}'::jsonb
  AND review_json <> '{}'::jsonb;
