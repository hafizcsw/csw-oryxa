import readinessDimensions from '../../supabase/seed/russian/01_readiness_dimensions.json';
import courses from '../../supabase/seed/russian/02_courses.json';
import modules from '../../supabase/seed/russian/03_modules_shared_core.json';
import lessons from '../../supabase/seed/russian/04_lessons_shared_core.json';
import lessonSections from '../../supabase/seed/russian/05_lesson_sections_shared_core.json';
import assessmentTemplates from '../../supabase/seed/russian/06_assessment_templates.json';
import examSets from '../../supabase/seed/russian/07_exam_sets.json';

export const RUSSIAN_EXECUTION_PACK_COURSE_KEY = 'russian_shared_core_v1';

export const russianReadinessDimensions = readinessDimensions as Array<{
  dimension_key: string;
  label: string;
  dimension_group: string;
  dashboard_order: number;
  max_score: number;
}>;

export const russianSeedCourses = courses as Array<{
  course_key: string;
  title: string;
  goal_type: string;
  academic_track: string;
  visibility: string;
}>;

export const russianSeedModules = modules as Array<{
  course_key: string;
  module_key: string;
  slug: string;
  title: string;
  module_type: string;
  domain_track: string;
  cefr_band: string;
  ordinal: number;
  estimated_minutes: number;
  checkpoint_family_key: string | null;
  unlock_rule: { type: string; previous_module_required?: boolean };
}>;

export const russianSeedLessons = lessons as Array<{
  module_key: string;
  lesson_key: string;
  slug: string;
  title: string;
  lesson_type: string;
  track_scope: string;
  ordinal: number;
  estimated_minutes: number;
  readiness_weight: number;
  checkpoint_family_key: string | null;
  unlock_rule: { type: string };
  metadata?: { primary_dimension_key?: string };
  lane?: string;
  lesson_mode?: string;
  readiness_target?: string;
  can_do_outcomes?: string[];
  grammar_focus?: string[];
  function_focus?: string[];
  teacher_notes?: string[];
  mastery_rules?: { minimum_required_blocks?: number; minimum_quiz_score?: number };
  ordered_block_refs?: string[];
  homework_refs?: string[];
  checkpoint_links?: string[];
  mock_links?: string[];
  identity_mapping?: { canonical_slug: string; mapping_mode: string; mapped_concept_title: string; note?: string };
}>;

export const russianSeedLessonSections = lessonSections as Array<{
  lesson_key: string;
  section_key: string;
  section_type: string;
  ordinal: number;
  title: string;
  estimated_minutes: number;
  is_required: boolean;
  content_json: { contentKey: string; trackScope: string; blockTemplate: string; blockType?: string; blockRef?: string };
  block_type?: string;
  block_ref?: string;
  mastery_gate: { completionRequired: boolean; checkpointSource: boolean };
}>;

export const russianSeedAssessmentTemplates = assessmentTemplates as Array<{
  template_key: string;
  course_key: string;
  template_type: string;
  checkpoint_family_key: string | null;
  title: string;
  version: string;
  track_scope: string;
  total_items: number;
  passing_score: number | null;
  lesson_scope_keys: string[];
  module_scope_keys: string[];
  scoring_json: Record<string, unknown>;
  blueprint_json: Record<string, unknown>;
}>;

export const russianSeedExamSets = examSets as Array<{
  exam_set_key: string;
  course_key: string;
  title: string;
  exam_family: string;
  track_scope: string;
  version: string;
  lesson_scope_keys: string[];
  module_scope_keys: string[];
  total_sections: number;
  total_items: number;
  target_score: number;
  release_stage: string;
  blueprint_json: Record<string, unknown>;
}>;

export const russianRuntimeModuleOrder = [
  'foundations_01_script_sounds',
  'foundations_02_core_interaction',
  'foundations_03_survival_navigation',
  'academic_01_classroom_basics',
  'academic_02_reading_patterns',
  'checkpoint_01_foundation',
  'academic_03_note_taking_response',
  'grammar_01_case_awareness',
  'grammar_02_verbs_motion_time',
  'checkpoint_02_academic_entry',
] as const;

const runtimeOrderIndex = new Map(russianRuntimeModuleOrder.map((moduleKey, index) => [moduleKey, index]));

export const russianRuntimeModules = [...russianSeedModules].sort((a, b) => {
  const aIndex = runtimeOrderIndex.get(a.module_key as any) ?? Number.MAX_SAFE_INTEGER;
  const bIndex = runtimeOrderIndex.get(b.module_key as any) ?? Number.MAX_SAFE_INTEGER;
  return aIndex - bIndex || a.ordinal - b.ordinal;
});

export const russianRuntimeLessons = russianRuntimeModules.flatMap((module) =>
  russianSeedLessons
    .filter((lesson) => lesson.module_key === module.module_key)
    .sort((a, b) => a.ordinal - b.ordinal)
);

export const russianLessonsByModuleKey = russianSeedLessons.reduce<Record<string, typeof russianSeedLessons>>((acc, lesson) => {
  if (!acc[lesson.module_key]) acc[lesson.module_key] = [];
  acc[lesson.module_key].push(lesson);
  return acc;
}, {});

export const russianSectionsByLessonKey = russianSeedLessonSections.reduce<Record<string, typeof russianSeedLessonSections>>((acc, section) => {
  if (!acc[section.lesson_key]) acc[section.lesson_key] = [];
  acc[section.lesson_key].push(section);
  return acc;
}, {});

export const russianDimensionLabels = russianReadinessDimensions.reduce<Record<string, string>>((acc, dimension) => {
  acc[dimension.dimension_key] = dimension.label;
  return acc;
}, {});

export function getRussianSeedCourse(courseKey = RUSSIAN_EXECUTION_PACK_COURSE_KEY) {
  return russianSeedCourses.find((course) => course.course_key === courseKey) ?? null;
}

export function getRussianPlacementTemplate() {
  return russianSeedAssessmentTemplates.find((template) => template.template_type === 'placement') ?? null;
}

export function getRussianCheckpointTemplate(templateKey: string) {
  return russianSeedAssessmentTemplates.find((template) => template.template_key === templateKey) ?? null;
}

export function getRussianModuleByKey(moduleKey: string) {
  return russianSeedModules.find((module) => module.module_key === moduleKey) ?? null;
}

export function getRussianLessonByKey(lessonKey: string) {
  return russianSeedLessons.find((lesson) => lesson.lesson_key === lessonKey) ?? null;
}

export function getRussianLessonBySlug(slug: string) {
  return russianSeedLessons.find((lesson) => lesson.slug === slug) ?? null;
}

export function getRussianModuleBySlug(slug: string) {
  return russianSeedModules.find((module) => module.slug === slug) ?? null;
}
