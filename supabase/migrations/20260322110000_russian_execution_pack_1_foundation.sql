-- Russian Section — Execution Pack 1
-- Data/Foundation Layer baseline derived from the accepted Russian section contract.
-- Scope: schema only for course graph, readiness, placement, unlocks, checkpoints, and exam attempts.

-- 1) Courses
-- Naming hardening: all Execution Pack 1 tables are Russian-scoped to avoid collisions with existing or future generic product tables.
CREATE TABLE IF NOT EXISTS public.russian_learning_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_key TEXT NOT NULL UNIQUE,
  language_code TEXT NOT NULL DEFAULT 'ru',
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL,
  academic_track TEXT NOT NULL DEFAULT 'shared_foundation',
  delivery_mode TEXT NOT NULL DEFAULT 'self_paced',
  visibility TEXT NOT NULL DEFAULT 'active',
  version TEXT NOT NULL DEFAULT 'v1',
  placement_required BOOLEAN NOT NULL DEFAULT true,
  readiness_profile_enabled BOOLEAN NOT NULL DEFAULT true,
  dashboard_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT courses_goal_type_check CHECK (goal_type IN ('prep_exam', 'university_study', 'daily_life')),
  CONSTRAINT courses_academic_track_check CHECK (academic_track IN ('shared_foundation', 'academic_core', 'medicine', 'engineering', 'humanities_social')),
  CONSTRAINT courses_delivery_mode_check CHECK (delivery_mode IN ('self_paced', 'cohort', 'blended')),
  CONSTRAINT courses_visibility_check CHECK (visibility IN ('draft', 'active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_courses_language_track ON public.russian_learning_courses(language_code, academic_track, visibility);

-- 2) Modules
CREATE TABLE IF NOT EXISTS public.russian_learning_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.russian_learning_courses(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  module_type TEXT NOT NULL DEFAULT 'instruction',
  domain_track TEXT NOT NULL DEFAULT 'shared_foundation',
  cefr_band TEXT,
  ordinal INTEGER NOT NULL,
  unlock_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_minutes INTEGER NOT NULL DEFAULT 0,
  checkpoint_family_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT modules_type_check CHECK (module_type IN ('instruction', 'checkpoint', 'review', 'exam_prep')),
  CONSTRAINT modules_domain_track_check CHECK (domain_track IN ('shared_foundation', 'academic_core', 'medicine', 'engineering', 'humanities_social')),
  CONSTRAINT modules_course_ordinal_unique UNIQUE (course_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_modules_course ON public.russian_learning_modules(course_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_modules_track ON public.russian_learning_modules(domain_track, module_type);

-- 3) Lessons
CREATE TABLE IF NOT EXISTS public.russian_learning_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.russian_learning_modules(id) ON DELETE CASCADE,
  lesson_key TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  lesson_type TEXT NOT NULL DEFAULT 'content',
  track_scope TEXT NOT NULL DEFAULT 'shared_foundation',
  ordinal INTEGER NOT NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 15,
  readiness_weight NUMERIC(5,2) NOT NULL DEFAULT 0,
  checkpoint_family_key TEXT,
  unlock_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lessons_type_check CHECK (lesson_type IN ('content', 'practice', 'checkpoint', 'review', 'exam_set')),
  CONSTRAINT lessons_track_scope_check CHECK (track_scope IN ('shared_foundation', 'academic_core', 'medicine', 'engineering', 'humanities_social')),
  CONSTRAINT lessons_module_ordinal_unique UNIQUE (module_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_lessons_module ON public.russian_learning_lessons(module_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_lessons_checkpoint_family ON public.russian_learning_lessons(checkpoint_family_key);

-- 4) Lesson blocks / sections
CREATE TABLE IF NOT EXISTS public.russian_learning_lesson_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.russian_learning_lessons(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL UNIQUE,
  section_type TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  title TEXT,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_minutes INTEGER NOT NULL DEFAULT 5,
  is_required BOOLEAN NOT NULL DEFAULT true,
  mastery_gate JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_sections_type_check CHECK (section_type IN ('intro', 'explanation', 'example', 'drill', 'vocabulary', 'dialogue', 'quiz', 'reflection')),
  CONSTRAINT lesson_sections_lesson_ordinal_unique UNIQUE (lesson_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_lesson_sections_lesson ON public.russian_learning_lesson_sections(lesson_id, ordinal);

-- 5) Readiness dimensions
CREATE TABLE IF NOT EXISTS public.russian_readiness_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  dimension_group TEXT NOT NULL,
  score_unit TEXT NOT NULL DEFAULT 'percent',
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  dashboard_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT readiness_dimensions_group_check CHECK (dimension_group IN ('foundation', 'academic', 'discipline', 'exam')),
  CONSTRAINT readiness_dimensions_unit_check CHECK (score_unit IN ('percent', 'ratio', 'count'))
);

CREATE INDEX IF NOT EXISTS idx_readiness_dimensions_group ON public.russian_readiness_dimensions(dimension_group, dashboard_order);

-- 6) Learner readiness profiles
CREATE TABLE IF NOT EXISTS public.russian_learner_readiness_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.russian_learning_courses(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.learning_enrollments(id) ON DELETE SET NULL,
  profile_status TEXT NOT NULL DEFAULT 'active',
  current_cefr_band TEXT,
  readiness_band TEXT NOT NULL DEFAULT 'emerging',
  overall_readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  shared_foundation_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  academic_core_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  discipline_overlay_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  exam_readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  placement_result_id UUID,
  latest_checkpoint_attempt_id UUID,
  latest_exam_attempt_id UUID,
  dimensions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot_version TEXT NOT NULL DEFAULT 'v1',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT readiness_profiles_status_check CHECK (profile_status IN ('active', 'superseded', 'archived')),
  CONSTRAINT readiness_profiles_band_check CHECK (readiness_band IN ('emerging', 'building', 'on_track', 'ready')),
  CONSTRAINT readiness_profiles_user_course_unique UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_learner_readiness_profiles_user ON public.russian_learner_readiness_profiles(user_id, course_id);

-- 7) Placement results
CREATE TABLE IF NOT EXISTS public.russian_placement_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.russian_learning_courses(id) ON DELETE CASCADE,
  assessment_template_id UUID,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  raw_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  normalized_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  placement_band TEXT NOT NULL,
  recommended_course_key TEXT,
  recommended_start_module_key TEXT,
  recommended_start_lesson_key TEXT,
  unlocked_module_keys TEXT[] NOT NULL DEFAULT '{}',
  unlocked_lesson_keys TEXT[] NOT NULL DEFAULT '{}',
  dimension_scores_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer_map_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT placement_results_band_check CHECK (placement_band IN ('start_from_zero', 'basics_refresh', 'early_academic')),
  CONSTRAINT placement_results_attempt_unique UNIQUE (user_id, course_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_placement_results_user_course ON public.russian_placement_results(user_id, course_id, completed_at DESC);

-- 8) Learner unlocks
CREATE TABLE IF NOT EXISTS public.russian_learner_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.russian_learning_courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.russian_learning_modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.russian_learning_lessons(id) ON DELETE CASCADE,
  unlock_type TEXT NOT NULL,
  unlock_source TEXT NOT NULL,
  source_ref_id UUID,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT learner_unlocks_type_check CHECK (unlock_type IN ('module', 'lesson', 'checkpoint', 'exam_set')),
  CONSTRAINT learner_unlocks_source_check CHECK (unlock_source IN ('placement', 'progression', 'manual', 'checkpoint_pass', 'exam_pass')),
  CONSTRAINT learner_unlocks_target_check CHECK ((module_id IS NOT NULL) OR (lesson_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learner_unlocks_unique_module ON public.russian_learner_unlocks(user_id, course_id, module_id, unlock_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_learner_unlocks_unique_lesson ON public.russian_learner_unlocks(user_id, course_id, lesson_id, unlock_type);
CREATE INDEX IF NOT EXISTS idx_learner_unlocks_user_course ON public.russian_learner_unlocks(user_id, course_id, unlocked_at DESC);

-- 9) Assessment templates
CREATE TABLE IF NOT EXISTS public.russian_assessment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  course_id UUID NOT NULL REFERENCES public.russian_learning_courses(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL,
  checkpoint_family_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL DEFAULT 'v1',
  lesson_scope_keys TEXT[] NOT NULL DEFAULT '{}',
  module_scope_keys TEXT[] NOT NULL DEFAULT '{}',
  track_scope TEXT NOT NULL DEFAULT 'shared_foundation',
  total_items INTEGER NOT NULL DEFAULT 0,
  passing_score NUMERIC(5,2),
  scoring_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  blueprint_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assessment_templates_type_check CHECK (template_type IN ('placement', 'checkpoint', 'diagnostic', 'practice_exam')),
  CONSTRAINT assessment_templates_track_scope_check CHECK (track_scope IN ('shared_foundation', 'academic_core', 'medicine', 'engineering', 'humanities_social'))
);

CREATE INDEX IF NOT EXISTS idx_assessment_templates_course_type ON public.russian_assessment_templates(course_id, template_type, checkpoint_family_key);

-- 10) Assessment attempts
CREATE TABLE IF NOT EXISTS public.russian_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.russian_learning_courses(id) ON DELETE CASCADE,
  assessment_template_id UUID NOT NULL REFERENCES public.russian_assessment_templates(id) ON DELETE CASCADE,
  learner_readiness_profile_id UUID REFERENCES public.russian_learner_readiness_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  score NUMERIC(6,2) NOT NULL DEFAULT 0,
  percent_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  passed BOOLEAN,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  dimension_scores_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  feedback_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT assessment_attempts_status_check CHECK (status IN ('in_progress', 'submitted', 'graded', 'voided')),
  CONSTRAINT assessment_attempts_unique_attempt UNIQUE (user_id, assessment_template_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user_course ON public.russian_assessment_attempts(user_id, course_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_template ON public.russian_assessment_attempts(assessment_template_id, submitted_at DESC);

-- 11) Exam sets
CREATE TABLE IF NOT EXISTS public.russian_exam_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_set_key TEXT NOT NULL UNIQUE,
  course_id UUID NOT NULL REFERENCES public.russian_learning_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  exam_family TEXT NOT NULL,
  track_scope TEXT NOT NULL DEFAULT 'shared_foundation',
  version TEXT NOT NULL DEFAULT 'v1',
  lesson_scope_keys TEXT[] NOT NULL DEFAULT '{}',
  module_scope_keys TEXT[] NOT NULL DEFAULT '{}',
  total_sections INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  target_score NUMERIC(5,2),
  release_stage TEXT NOT NULL DEFAULT 'draft',
  blueprint_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exam_sets_track_scope_check CHECK (track_scope IN ('shared_foundation', 'academic_core', 'medicine', 'engineering', 'humanities_social')),
  CONSTRAINT exam_sets_release_stage_check CHECK (release_stage IN ('draft', 'active', 'retired'))
);

CREATE INDEX IF NOT EXISTS idx_exam_sets_course_family ON public.russian_exam_sets(course_id, exam_family, track_scope);

-- 12) Exam attempts
CREATE TABLE IF NOT EXISTS public.russian_exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.russian_learning_courses(id) ON DELETE CASCADE,
  exam_set_id UUID NOT NULL REFERENCES public.russian_exam_sets(id) ON DELETE CASCADE,
  learner_readiness_profile_id UUID REFERENCES public.russian_learner_readiness_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  score NUMERIC(6,2) NOT NULL DEFAULT 0,
  percent_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  readiness_band TEXT,
  passed BOOLEAN,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  section_scores_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exam_attempts_status_check CHECK (status IN ('in_progress', 'submitted', 'graded', 'voided')),
  CONSTRAINT exam_attempts_band_check CHECK (readiness_band IS NULL OR readiness_band IN ('emerging', 'building', 'on_track', 'ready')),
  CONSTRAINT exam_attempts_unique_attempt UNIQUE (user_id, exam_set_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_course ON public.russian_exam_attempts(user_id, course_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_set ON public.russian_exam_attempts(exam_set_id, submitted_at DESC);

-- Optional back references after target tables exist.
ALTER TABLE public.russian_learner_readiness_profiles
  DROP CONSTRAINT IF EXISTS learner_readiness_profiles_placement_result_id_fkey,
  ADD CONSTRAINT learner_readiness_profiles_placement_result_id_fkey
    FOREIGN KEY (placement_result_id) REFERENCES public.russian_placement_results(id) ON DELETE SET NULL;

ALTER TABLE public.russian_learner_readiness_profiles
  DROP CONSTRAINT IF EXISTS learner_readiness_profiles_latest_checkpoint_attempt_id_fkey,
  ADD CONSTRAINT learner_readiness_profiles_latest_checkpoint_attempt_id_fkey
    FOREIGN KEY (latest_checkpoint_attempt_id) REFERENCES public.russian_assessment_attempts(id) ON DELETE SET NULL;

ALTER TABLE public.russian_learner_readiness_profiles
  DROP CONSTRAINT IF EXISTS learner_readiness_profiles_latest_exam_attempt_id_fkey,
  ADD CONSTRAINT learner_readiness_profiles_latest_exam_attempt_id_fkey
    FOREIGN KEY (latest_exam_attempt_id) REFERENCES public.russian_exam_attempts(id) ON DELETE SET NULL;

ALTER TABLE public.russian_placement_results
  DROP CONSTRAINT IF EXISTS placement_results_assessment_template_id_fkey,
  ADD CONSTRAINT placement_results_assessment_template_id_fkey
    FOREIGN KEY (assessment_template_id) REFERENCES public.russian_assessment_templates(id) ON DELETE SET NULL;
