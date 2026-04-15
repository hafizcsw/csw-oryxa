import { supabase } from '@/integrations/supabase/client';
import { getProgress } from '@/lib/russianCourse';
import { applyRussianIntensiveAttemptState } from '@/lib/russianIntensive750AssessmentRuntime';
import { getPersistedRussianIntensiveAttemptSummaries, getPersistedRussianIntensiveReviewState } from '@/lib/russianIntensive750Persistence';
import { buildRussianIntensive750Runtime } from '@/lib/russianIntensive750Runtime';
import {
  RUSSIAN_EXECUTION_PACK_COURSE_KEY,
  getRussianPlacementTemplate,
  getRussianSeedCourse,
  russianDimensionLabels,
  russianReadinessDimensions,
  russianRuntimeLessons,
  russianRuntimeModuleOrder,
  russianRuntimeModules,
  russianSectionsByLessonKey,
} from '@/lib/russianExecutionPackSeed';
import type {
  DashboardPayload,
  LearnerReadinessProfilePayload,
  LessonProgressionPayload,
  PlacementBand,
  PlacementResultOutput,
  ReadinessBand,
  UnlockStatePayload,
} from '@/types/russianExecutionPack';
import type { RussianPlacementResult } from '@/lib/russianPlacementTypes';
import i18n from '@/i18n';
import { translateLanguageCourseValue } from '@/lib/languageCourseI18n';
import { getLanguageCourseDashboardRoute } from '@/lib/languageCourseConfig';

const sb = supabase as any;
const CHECKPOINT_01_TEMPLATE_KEY = 'shared_core_checkpoint_01_v1';
const EXAM_SET_01_KEY = 'shared_core_exam_set_01_v1';
const CHECKPOINT_01_REQUIRED_LESSONS = 15;
const TOTAL_SHARED_CORE_RUNTIME_LESSONS = russianRuntimeLessons.length;

function translateRuntimeCourseTitle(courseKey: string) {
  return i18n.t('languages.runtime.course.title', { defaultValue: translateLanguageCourseValue(i18n.t.bind(i18n), `languages.runtime.course.${courseKey}`, courseKey) });
}

function translateRuntimeModuleTitle(moduleKey: string) {
  return translateLanguageCourseValue(i18n.t.bind(i18n), `languages.runtime.modules.${moduleKey}`, moduleKey);
}

function translateRuntimeLessonTitle(lessonKey: string | null) {
  return lessonKey ? translateLanguageCourseValue(i18n.t.bind(i18n), `languages.runtime.lessons.${lessonKey}`, lessonKey) : null;
}

const CHECKPOINT_UNLOCK_MODULE_KEYS = [
  'academic_03_note_taking_response',
  'grammar_01_case_awareness',
  'grammar_02_verbs_motion_time',
];

function mapPlacementBand(category: string): PlacementBand {
  if (category === 'basics_refresh' || category === 'PB1_GENERAL_FOUNDATION' || category === 'PB2_GENERAL_CORE') return category as PlacementBand;
  if (category === 'early_academic' || category === 'PB3_ACADEMIC_ENTRY' || category === 'PB4_ACADEMIC_READY_EARLY_TRACK_SIGNAL' || category === 'PB5_PREP_ACCELERATED_ENTRY') return category as PlacementBand;
  return category === 'PB0_SCRIPT_FOUNDATION' ? 'PB0_SCRIPT_FOUNDATION' : 'start_from_zero';
}

function readinessBandFromScore(score: number): ReadinessBand {
  if (score >= 85) return 'ready';
  if (score >= 65) return 'on_track';
  if (score >= 35) return 'building';
  return 'emerging';
}

function lessonsForModule(moduleKey: string) {
  return russianRuntimeLessons.filter((lesson) => lesson.module_key === moduleKey).sort((a, b) => a.ordinal - b.ordinal);
}

function firstLessonKeyForModule(moduleKey: string) {
  return lessonsForModule(moduleKey)[0]?.lesson_key ?? null;
}

function getRuntimeModuleOrderIndex(moduleKey: string) {
  const index = russianRuntimeModuleOrder.indexOf(moduleKey as (typeof russianRuntimeModuleOrder)[number]);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function getCheckpoint01LessonKeys() {
  return lessonsForModule('checkpoint_01_foundation').map((lesson) => lesson.lesson_key);
}

function getCompletedRuntimeLessons(progress = getProgress()) {
  return russianRuntimeLessons.filter((lesson) => progress.completedLessons.includes(lesson.slug));
}

function getContiguousRuntimeLessonKeys(progress = getProgress()) {
  const contiguous: string[] = [];
  for (const lesson of russianRuntimeLessons) {
    if (!progress.completedLessons.includes(lesson.slug)) break;
    contiguous.push(lesson.lesson_key);
  }
  return contiguous;
}

function isCheckpoint01PassedFromProgress(progress = getProgress()) {
  const completedLessonKeys = new Set(getCompletedRuntimeLessons(progress).map((lesson) => lesson.lesson_key));
  return getCheckpoint01LessonKeys().every((lessonKey) => completedLessonKeys.has(lessonKey));
}

function computeRuntimeUnlockState(progress = getProgress(), options?: { checkpointPassed?: boolean }) {
  const completedLessonKeys = new Set(getCompletedRuntimeLessons(progress).map((lesson) => lesson.lesson_key));
  const contiguousLessonKeys = new Set(getContiguousRuntimeLessonKeys(progress));
  const completedCount = getCompletedRuntimeLessons(progress).length;
  const checkpointEligible = completedCount >= CHECKPOINT_01_REQUIRED_LESSONS;
  const checkpointLessonBlockComplete = isCheckpoint01PassedFromProgress(progress);
  const checkpointPassed = Boolean(options?.checkpointPassed);

  const unlockedModuleKeys = russianRuntimeModules
    .filter((module) => {
      if (module.module_key === 'checkpoint_01_foundation') return checkpointEligible;
      if (CHECKPOINT_UNLOCK_MODULE_KEYS.includes(module.module_key)) return checkpointPassed;
      if (module.module_key === 'checkpoint_02_academic_entry') {
        return CHECKPOINT_UNLOCK_MODULE_KEYS.every((candidate) =>
          lessonsForModule(candidate).every((lesson) => completedLessonKeys.has(lesson.lesson_key))
        );
      }
      const moduleIndex = getRuntimeModuleOrderIndex(module.module_key);
      if (moduleIndex === 0) return true;
      const previousRuntimeModule = russianRuntimeModules[moduleIndex - 1];
      if (!previousRuntimeModule) return false;
      return lessonsForModule(previousRuntimeModule.module_key).every((lesson) => completedLessonKeys.has(lesson.lesson_key));
    })
    .map((module) => module.module_key);

  const unlockedLessonKeys = russianRuntimeLessons
    .filter((lesson, index) => {
      if (completedLessonKeys.has(lesson.lesson_key)) return true;
      if (!unlockedModuleKeys.includes(lesson.module_key)) return false;
      if (index === 0) return true;
      const previousLesson = russianRuntimeLessons[index - 1];
      return contiguousLessonKeys.has(previousLesson.lesson_key);
    })
    .map((lesson) => lesson.lesson_key);

  return {
    completedCount,
    checkpointEligible,
    checkpointLessonBlockComplete,
    checkpointPassed,
    unlockedModuleKeys,
    unlockedLessonKeys,
  };
}

function getNextRuntimeLesson(progress = getProgress(), checkpointPassed = false) {
  const runtimeState = computeRuntimeUnlockState(progress, { checkpointPassed });
  const unlockedLessonKeySet = new Set(runtimeState.unlockedLessonKeys);
  const nextUnlockedLesson = russianRuntimeLessons.find((lesson) =>
    unlockedLessonKeySet.has(lesson.lesson_key) && !progress.completedLessons.includes(lesson.slug)
  );

  if (nextUnlockedLesson) return nextUnlockedLesson;

  if (runtimeState.checkpointEligible && !checkpointPassed) {
    return lessonsForModule('checkpoint_01_foundation').find((lesson) => !progress.completedLessons.includes(lesson.slug))
      ?? lessonsForModule('checkpoint_01_foundation')[lessonsForModule('checkpoint_01_foundation').length - 1]
      ?? null;
  }

  return russianRuntimeLessons.find((lesson) => !progress.completedLessons.includes(lesson.slug))
    ?? russianRuntimeLessons[russianRuntimeLessons.length - 1]
    ?? null;
}

export function buildPlacementOutcome(score: number, totalQuestions: number, result?: RussianPlacementResult): PlacementResultOutput {
  const normalizedScore = result?.weighted_score ?? (totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0);
  const legacyPlacementCategory = result?.legacy_result_category ?? (normalizedScore <= 30 ? 'start_from_zero' : normalizedScore <= 60 ? 'basics_refresh' : 'early_academic');
  const canonicalPlacementBand = result?.placement_band ?? (legacyPlacementCategory === 'start_from_zero' ? 'PB0_SCRIPT_FOUNDATION' : legacyPlacementCategory === 'basics_refresh' ? 'PB1_GENERAL_FOUNDATION' : 'PB3_ACADEMIC_ENTRY');
  const placementBand = mapPlacementBand(canonicalPlacementBand);

  let unlockedModuleKeys: string[] = ['foundations_01_script_sounds'];
  let recommendedStartModuleKey = result?.start_module ?? 'foundations_01_script_sounds';
  let recommendedStartLessonKey = firstLessonKeyForModule(recommendedStartModuleKey) ?? null;

  if (placementBand === 'basics_refresh' || placementBand === 'PB1_GENERAL_FOUNDATION' || placementBand === 'PB2_GENERAL_CORE') {
    unlockedModuleKeys = [
      'foundations_01_script_sounds',
      'foundations_02_core_interaction',
      'foundations_03_survival_navigation',
    ];
    recommendedStartModuleKey = placementBand === 'PB1_GENERAL_FOUNDATION' ? 'foundations_02_core_interaction' : 'foundations_03_survival_navigation';
    recommendedStartLessonKey = placementBand === 'PB1_GENERAL_FOUNDATION' ? 'introductions_identity' : 'numbers_dates_time';
  }

  if (placementBand === 'early_academic' || placementBand === 'PB3_ACADEMIC_ENTRY' || placementBand === 'PB4_ACADEMIC_READY_EARLY_TRACK_SIGNAL' || placementBand === 'PB5_PREP_ACCELERATED_ENTRY') {
    unlockedModuleKeys = [
      'foundations_01_script_sounds',
      'foundations_02_core_interaction',
      'foundations_03_survival_navigation',
      'academic_01_classroom_basics',
      'academic_02_reading_patterns',
    ];
    recommendedStartModuleKey = placementBand === 'PB5_PREP_ACCELERATED_ENTRY' ? 'academic_03_note_taking_response' : placementBand === 'PB4_ACADEMIC_READY_EARLY_TRACK_SIGNAL' ? 'academic_02_reading_patterns' : 'academic_01_classroom_basics';
    recommendedStartLessonKey = placementBand === 'PB5_PREP_ACCELERATED_ENTRY' ? 'note_taking_signal' : 'university_vocabulary';
  }

  const unlockedLessonKeys = russianRuntimeLessons
    .filter((lesson) => unlockedModuleKeys.includes(lesson.module_key))
    .map((lesson) => lesson.lesson_key);

  const dimensionScores = result
    ? [
        { dimensionKey: 'script_readiness', score: result.script_readiness, band: readinessBandFromScore(result.script_readiness) },
        { dimensionKey: 'general_readiness', score: result.general_readiness, band: readinessBandFromScore(result.general_readiness) },
        { dimensionKey: 'academic_readiness', score: result.academic_readiness, band: readinessBandFromScore(result.academic_readiness) },
        { dimensionKey: 'prep_readiness', score: result.prep_readiness, band: readinessBandFromScore(result.prep_readiness) },
      ]
    : russianReadinessDimensions.slice(0, 3).map((dimension, index) => {
        const base = normalizedScore - index * 10;
        const scoreValue = Math.max(0, Math.min(100, base));
        return {
          dimensionKey: dimension.dimension_key,
          score: scoreValue,
          band: readinessBandFromScore(scoreValue),
        };
      });

  return {
    placement_version: result?.placement_version ?? 'russian_placement_v2',
    placement_band: canonicalPlacementBand,
    legacy_result_category: legacyPlacementCategory,
    confidence: result?.confidence ?? 'medium',
    confidence_score: result?.confidence_score ?? 60,
    script_readiness: result?.script_readiness ?? normalizedScore,
    general_readiness: result?.general_readiness ?? Math.max(0, normalizedScore - 8),
    academic_readiness: result?.academic_readiness ?? Math.max(0, normalizedScore - 15),
    prep_readiness: result?.prep_readiness ?? Math.max(0, normalizedScore - 20),
    track_signal: result?.track_signal ?? { medicine: 0, engineering: 0, humanities_social: 0 },
    gates: result?.gates ?? { script_gate_pass: normalizedScore >= 45, academic_gate_pass: normalizedScore >= 65, prep_gate_pass: normalizedScore >= 80 },
    recommended_path: result?.recommended_path ?? RUSSIAN_EXECUTION_PACK_COURSE_KEY,
    start_stage: result?.start_stage ?? 'general_foundation',
    start_module: result?.start_module ?? recommendedStartModuleKey ?? 'foundations_01_script_sounds',
    start_lesson_band: result?.start_lesson_band,
    track_recommendation: result?.track_recommendation ?? 'unclear',
    strongest_area: result?.strongest_area ?? 'general_vocabulary',
    weakest_area: result?.weakest_area ?? 'script_recognition',
    weak_areas: result?.weak_areas ?? ['script_recognition'],
    recommended_review_focus: result?.recommended_review_focus ?? ['script_recognition'],
    dashboard_flags: result?.dashboard_flags ?? [],
    weighted_score: result?.weighted_score ?? normalizedScore,
    block_scores: result?.block_scores ?? {
      A_SCRIPT: { answered: 0, correctWeight: 0, totalWeight: 0, percent: normalizedScore },
      B_GENERAL: { answered: 0, correctWeight: 0, totalWeight: 0, percent: Math.max(0, normalizedScore - 8) },
      C_COMPREHENSION: { answered: 0, correctWeight: 0, totalWeight: 0, percent: Math.max(0, normalizedScore - 12) },
      D_ACADEMIC: { answered: 0, correctWeight: 0, totalWeight: 0, percent: Math.max(0, normalizedScore - 15) },
      E_TRACK: { answered: 0, correctWeight: 0, totalWeight: 0, percent: 0 },
    },
    meta: result?.meta ?? {},
    asked_question_ids: result?.asked_question_ids ?? [],
    completed_at: result?.completed_at ?? new Date().toISOString(),
    placementResultId: '',
    courseKey: RUSSIAN_EXECUTION_PACK_COURSE_KEY,
    attemptNo: 1,
    placementBand,
    rawScore: score,
    normalizedScore,
    recommendedCourseKey: RUSSIAN_EXECUTION_PACK_COURSE_KEY,
    recommendedStartModuleKey,
    recommendedStartLessonKey,
    unlocks: {
      moduleKeys: unlockedModuleKeys,
      lessonKeys: unlockedLessonKeys,
    },
    dimensionScores,
    dashboardRedirect: {
      dashboardRoute: getLanguageCourseDashboardRoute('russian'),
      resumeModuleKey: recommendedStartModuleKey,
      resumeLessonKey: recommendedStartLessonKey,
    },
    completedAt: result?.completed_at ?? new Date().toISOString(),
  };
}

function computeDimensionScores(completedLessonSlugs: string[], placement: PlacementResultOutput | null) {
  return russianReadinessDimensions.map((dimension) => {
    const scopedLessons = russianRuntimeLessons.filter((lesson) => lesson.metadata?.primary_dimension_key === dimension.dimension_key);
    const completed = scopedLessons.filter((lesson) => completedLessonSlugs.includes(lesson.slug)).length;
    const progressScore = scopedLessons.length ? Math.round((completed / scopedLessons.length) * 100) : 0;
    const placementBoost = placement?.dimensionScores.find((entry) => entry.dimensionKey === dimension.dimension_key)?.score ?? 0;
    const score = Math.round(progressScore * 0.7 + placementBoost * 0.3);
    return {
      dimensionKey: dimension.dimension_key,
      label: russianDimensionLabels[dimension.dimension_key] ?? dimension.dimension_key,
      score,
      band: readinessBandFromScore(score),
      evidence: {
        placementResultId: placement?.placementResultId ?? null,
        latestAssessmentAttemptId: null,
        completedLessonCount: completed,
      },
    };
  });
}

export function buildReadinessProfile(userId: string, placement: PlacementResultOutput | null): LearnerReadinessProfilePayload {
  const progress = getProgress();
  const dimensions = computeDimensionScores(progress.completedLessons, placement);
  const overallReadinessScore = dimensions.length
    ? Math.round(dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length)
    : 0;

  return {
    profileId: '',
    userId,
    courseKey: RUSSIAN_EXECUTION_PACK_COURSE_KEY,
    readinessBand: readinessBandFromScore(overallReadinessScore),
    currentCefrBand: overallReadinessScore < 25 ? 'A0' : overallReadinessScore < 50 ? 'A1' : overallReadinessScore < 75 ? 'A1+' : 'A2',
    overallReadinessScore,
    layerScores: {
      sharedFoundation: Math.round((dimensions.filter((d) => ['foundation', 'exam'].includes((russianReadinessDimensions.find((rd) => rd.dimension_key === d.dimensionKey)?.dimension_group) || 'foundation')).reduce((sum, dimension) => sum + dimension.score, 0)) / 4) || 0,
      academicCore: Math.round((dimensions.filter((d) => (russianReadinessDimensions.find((rd) => rd.dimension_key === d.dimensionKey)?.dimension_group) === 'academic').reduce((sum, dimension) => sum + dimension.score, 0)) / 3) || 0,
      disciplineOverlay: 0,
      examReadiness: dimensions.find((dimension) => dimension.dimensionKey === 'exam_checkpoint_readiness')?.score ?? 0,
    },
    dimensions,
    recommendations: [
      {
        type: 'next_lesson',
        targetKey: getNextRecommendedLessonKey(progress.completedLessons),
        reason: 'Next shared-core lesson in the current learner path.',
      },
      {
        type: 'checkpoint',
        targetKey: CHECKPOINT_01_TEMPLATE_KEY,
        reason: 'Checkpoint 01 unlocks at 15 completed lessons in the shared core.',
      },
    ],
    calculatedAt: new Date().toISOString(),
  };
}

function getNextRecommendedLessonKey(completedLessonSlugs: string[]) {
  const next = russianRuntimeLessons.find((lesson) => !completedLessonSlugs.includes(lesson.slug));
  return next?.lesson_key ?? russianRuntimeLessons[russianRuntimeLessons.length - 1]?.lesson_key ?? 'alphabet_map';
}

async function findCourseId() {
  const { data } = await sb
    .from('russian_learning_courses')
    .select('id, course_key, title, goal_type, academic_track')
    .eq('course_key', RUSSIAN_EXECUTION_PACK_COURSE_KEY)
    .maybeSingle();
  return data ?? null;
}

async function findLatestCourseEnrollment(userId: string) {
  const { data } = await sb
    .from('language_course_enrollments')
    .select('course_type, price_usd, activation_status, request_status')
    .eq('user_id', userId)
    .eq('language_key', 'russian')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function findPersistedExamNotices(userId: string) {
  const { data } = await sb
    .from('learning_exam_notices')
    .select('*')
    .eq('user_id', userId);
  return (data ?? []) as any[];
}

async function findPlacementTemplateId() {
  const template = getRussianPlacementTemplate();
  if (!template) return null;
  const { data } = await sb
    .from('russian_assessment_templates')
    .select('id, template_key')
    .eq('template_key', template.template_key)
    .maybeSingle();
  return data?.id ?? null;
}

async function findCheckpointTemplateRow(templateKey = CHECKPOINT_01_TEMPLATE_KEY) {
  const { data } = await sb
    .from('russian_assessment_templates')
    .select('id, template_key, passing_score')
    .eq('template_key', templateKey)
    .maybeSingle();
  return data ?? null;
}

async function findExamSetRow(examSetKey = EXAM_SET_01_KEY) {
  const { data } = await sb
    .from('russian_exam_sets')
    .select('id, exam_set_key, target_score, release_stage')
    .eq('exam_set_key', examSetKey)
    .maybeSingle();
  return data ?? null;
}

async function findModuleRows(moduleKeys: string[]) {
  if (moduleKeys.length === 0) return [];
  const { data } = await sb
    .from('russian_learning_modules')
    .select('id, module_key')
    .in('module_key', moduleKeys);
  return data || [];
}

async function findLessonRows(lessonKeys: string[]) {
  if (lessonKeys.length === 0) return [];
  const { data } = await sb
    .from('russian_learning_lessons')
    .select('id, lesson_key')
    .in('lesson_key', lessonKeys);
  return data || [];
}

function buildRuntimeMissing(course: any, checkpointTemplate: any, examSet: any) {
  const missing: string[] = [];
  if (!course?.id) missing.push('russian_learning_courses:russian_shared_core_v1');
  if (!checkpointTemplate?.id) missing.push(`russian_assessment_templates:${CHECKPOINT_01_TEMPLATE_KEY}`);
  if (!examSet?.id) missing.push(`russian_exam_sets:${EXAM_SET_01_KEY}`);
  return missing;
}

export async function persistPlacementResult(userId: string, score: number, totalQuestions: number, resultCategory: string, answers: Record<number | string, number | string>, result?: RussianPlacementResult) {
  const course = await findCourseId();

  const outcome = buildPlacementOutcome(score, totalQuestions, result);
  const canonicalPersistedBand = result?.placement_band ?? outcome.placement_band;
  outcome.placement_band = canonicalPersistedBand;
  outcome.placementBand = mapPlacementBand(canonicalPersistedBand);
  outcome.placementBand = mapPlacementBand(result?.placement_band ?? resultCategory);
  if (!course?.id) return outcome;

  const placementTemplateId = await findPlacementTemplateId();

  const { data } = await sb
    .from('russian_placement_results')
    .upsert({
      user_id: userId,
      course_id: course.id,
      assessment_template_id: placementTemplateId,
      attempt_no: 1,
      raw_score: score,
      normalized_score: outcome.normalizedScore,
      placement_band: outcome.placement_band,
      recommended_course_key: outcome.recommendedCourseKey,
      recommended_start_module_key: outcome.recommendedStartModuleKey,
      recommended_start_lesson_key: outcome.recommendedStartLessonKey,
      unlocked_module_keys: outcome.unlocks.moduleKeys,
      unlocked_lesson_keys: outcome.unlocks.lessonKeys,
      dimension_scores_json: outcome.dimensionScores,
      answer_map_json: answers,
      result_payload: outcome,
    }, { onConflict: 'user_id,course_id,attempt_no' })
    .select('id')
    .single();

  outcome.placementResultId = data?.id ?? '';

  await persistUnlockState(userId, course.id, outcome.unlocks.moduleKeys, outcome.unlocks.lessonKeys, 'placement', data?.id ?? null);
  await persistReadinessProfile(userId, outcome, course.id, data?.id ?? null);

  return outcome;
}

export async function persistUnlockState(
  userId: string,
  courseId: string,
  moduleKeys: string[],
  lessonKeys: string[],
  source: 'placement' | 'progression' | 'checkpoint_pass' | 'exam_pass' | 'manual',
  sourceRefId: string | null,
) {
  const moduleRows = await findModuleRows(moduleKeys);
  const lessonRows = await findLessonRows(lessonKeys);
  const now = new Date().toISOString();

  const moduleWrites = moduleRows.map((row: { id: string }) =>
    sb.from('russian_learner_unlocks').upsert({
      user_id: userId,
      course_id: courseId,
      module_id: row.id,
      unlock_type: 'module',
      unlock_source: source,
      source_ref_id: sourceRefId,
      unlocked_at: now,
    }, { onConflict: 'user_id,course_id,module_id,unlock_type' })
  );

  const lessonWrites = lessonRows.map((row: { id: string }) =>
    sb.from('russian_learner_unlocks').upsert({
      user_id: userId,
      course_id: courseId,
      lesson_id: row.id,
      unlock_type: 'lesson',
      unlock_source: source,
      source_ref_id: sourceRefId,
      unlocked_at: now,
    }, { onConflict: 'user_id,course_id,lesson_id,unlock_type' })
  );

  await Promise.all([...moduleWrites, ...lessonWrites]);
}

async function persistAssessmentTemplateUnlock(userId: string, courseId: string, templateKey: string, source: 'progression' | 'checkpoint_pass' | 'manual', sourceRefId: string | null) {
  const template = await findCheckpointTemplateRow(templateKey);
  if (!template?.id) return null;
  await sb.from('russian_learner_unlocks').upsert({
    user_id: userId,
    course_id: courseId,
    assessment_template_id: template.id,
    unlock_type: 'checkpoint',
    unlock_source: source,
    source_ref_id: sourceRefId,
    unlocked_at: new Date().toISOString(),
  }, { onConflict: 'user_id,course_id,assessment_template_id,unlock_type' });
  return template;
}

async function persistExamSetUnlock(userId: string, courseId: string, examSetKey: string, source: 'progression' | 'exam_pass' | 'manual', sourceRefId: string | null) {
  const examSet = await findExamSetRow(examSetKey);
  if (!examSet?.id) return null;
  await sb.from('russian_learner_unlocks').upsert({
    user_id: userId,
    course_id: courseId,
    exam_set_id: examSet.id,
    unlock_type: 'exam_set',
    unlock_source: source,
    source_ref_id: sourceRefId,
    unlocked_at: new Date().toISOString(),
  }, { onConflict: 'user_id,course_id,exam_set_id,unlock_type' });
  return examSet;
}

async function findLatestCheckpointAttempt(userId: string, courseId: string) {
  const template = await findCheckpointTemplateRow(CHECKPOINT_01_TEMPLATE_KEY);
  if (!template?.id) return null;
  const { data } = await sb
    .from('russian_assessment_attempts')
    .select('id, percent_score, passed, submitted_at')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('assessment_template_id', template.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function findLatestExamAttempt(userId: string, courseId: string) {
  const examSet = await findExamSetRow(EXAM_SET_01_KEY);
  if (!examSet?.id) return null;
  const { data } = await sb
    .from('russian_exam_attempts')
    .select('id, percent_score, passed, submitted_at')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('exam_set_id', examSet.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function persistReadinessProfile(userId: string, placement: PlacementResultOutput | null, courseId?: string, placementResultId?: string | null) {
  const course = courseId ? { id: courseId } : await findCourseId();
  const profile = buildReadinessProfile(userId, placement);
  if (!course?.id) return profile;

  const { data } = await sb
    .from('russian_learner_readiness_profiles')
    .upsert({
      user_id: userId,
      course_id: course.id,
      profile_status: 'active',
      current_cefr_band: profile.currentCefrBand,
      readiness_band: profile.readinessBand,
      overall_readiness_score: profile.overallReadinessScore,
      shared_foundation_score: profile.layerScores.sharedFoundation,
      academic_core_score: profile.layerScores.academicCore,
      discipline_overlay_score: profile.layerScores.disciplineOverlay,
      exam_readiness_score: profile.layerScores.examReadiness,
      placement_result_id: placementResultId ?? null,
      dimensions_json: profile.dimensions,
      recommendations_json: profile.recommendations,
      calculated_at: profile.calculatedAt,
      snapshot_version: 'v1',
    }, { onConflict: 'user_id,course_id' })
    .select('id')
    .single();

  profile.profileId = data?.id ?? '';
  return profile;
}

export async function syncRussianLearnerState(userId: string) {
  const course = await findCourseId();
  if (!course?.id) return buildReadinessProfile(userId, null);

  const progress = getProgress();
  const checkpointAttempt = await findLatestCheckpointAttempt(userId, course.id);
  const checkpointPassed = Boolean(checkpointAttempt?.passed);
  const runtimeState = computeRuntimeUnlockState(progress, { checkpointPassed });

  await persistUnlockState(userId, course.id, runtimeState.unlockedModuleKeys, runtimeState.unlockedLessonKeys, 'progression', null);

  const { data: latestPlacement } = await sb
    .from('russian_placement_results')
    .select('result_payload')
    .eq('user_id', userId)
    .eq('course_id', course.id)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const placement = latestPlacement?.result_payload ?? null;
  const profile = await persistReadinessProfile(userId, placement, course.id, placement?.placementResultId ?? null);

  if (runtimeState.checkpointEligible) {
    await persistAssessmentTemplateUnlock(userId, course.id, CHECKPOINT_01_TEMPLATE_KEY, 'progression', null);
  }

  if (checkpointPassed && checkpointAttempt?.id) {
    await persistUnlockState(userId, course.id, CHECKPOINT_UNLOCK_MODULE_KEYS, [], 'checkpoint_pass', checkpointAttempt.id);
    await persistAssessmentTemplateUnlock(userId, course.id, CHECKPOINT_01_TEMPLATE_KEY, 'checkpoint_pass', checkpointAttempt.id);
  }

  const latestExamAttempt = await findLatestExamAttempt(userId, course.id);

  if (runtimeState.completedCount >= TOTAL_SHARED_CORE_RUNTIME_LESSONS && checkpointPassed) {
    await persistExamSetUnlock(userId, course.id, EXAM_SET_01_KEY, 'progression', checkpointAttempt?.id ?? null);
  }

  await sb
    .from('russian_learner_readiness_profiles')
    .update({
      latest_checkpoint_attempt_id: checkpointAttempt?.id ?? null,
      latest_exam_attempt_id: latestExamAttempt?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('course_id', course.id);

  return profile;
}

export async function getRussianDashboardPayload(userId: string): Promise<DashboardPayload | null> {
  const [course, checkpointTemplate, examSet, courseEnrollment, persistedExamNotices, persistedIntensiveAttempts, persistedIntensiveReviewState] = await Promise.all([
    findCourseId(),
    findCheckpointTemplateRow(CHECKPOINT_01_TEMPLATE_KEY),
    findExamSetRow(EXAM_SET_01_KEY),
    findLatestCourseEnrollment(userId),
    findPersistedExamNotices(userId),
    getPersistedRussianIntensiveAttemptSummaries(userId),
    getPersistedRussianIntensiveReviewState(userId),
  ]);
  const progress = getProgress();
  const checkpointAttemptPreview = course?.id ? await findLatestCheckpointAttempt(userId, course.id) : null;
  const runtimeState = computeRuntimeUnlockState(progress, { checkpointPassed: Boolean(checkpointAttemptPreview?.passed) });
  const runtimeMissing = buildRuntimeMissing(course, checkpointTemplate, examSet);

  if (!course?.id) {
    const fallbackProfile = buildReadinessProfile(userId, null);
    const nextLesson = getNextRuntimeLesson(progress, false);
    const dashboardPayload: DashboardPayload = {
      runtime: { isDbReady: runtimeMissing.length === 0, missing: runtimeMissing },
      course: {
        courseKey: getRussianSeedCourse()?.course_key ?? RUSSIAN_EXECUTION_PACK_COURSE_KEY,
        title: translateRuntimeCourseTitle(getRussianSeedCourse()?.course_key ?? RUSSIAN_EXECUTION_PACK_COURSE_KEY),
        goalType: (getRussianSeedCourse()?.goal_type as any) ?? 'prep_exam',
        academicTrack: (getRussianSeedCourse()?.academic_track as any) ?? 'shared_foundation',
      },
      readiness: {
        profileId: fallbackProfile.profileId,
        readinessBand: fallbackProfile.readinessBand,
        overallReadinessScore: fallbackProfile.overallReadinessScore,
        surfaceDimensions: fallbackProfile.dimensions.slice(0, 3).map((dimension) => ({ dimensionKey: dimension.dimensionKey, score: dimension.score, band: dimension.band })),
        placementSummary: null,
      },
      resume: {
        moduleKey: nextLesson?.module_key ?? null,
        lessonKey: nextLesson?.lesson_key ?? null,
        lessonTitle: translateRuntimeLessonTitle(nextLesson?.lesson_key ?? null),
      },
      modules: russianRuntimeModules.map((module) => ({
        moduleKey: module.module_key,
        title: translateRuntimeModuleTitle(module.module_key),
        ordinal: module.ordinal,
        status: runtimeState.unlockedModuleKeys.includes(module.module_key) ? 'unlocked' : 'locked',
        isUnlocked: runtimeState.unlockedModuleKeys.includes(module.module_key),
        completion: {
          completedLessons: lessonsForModule(module.module_key).filter((lesson) => progress.completedLessons.includes(lesson.slug)).length,
          totalLessons: lessonsForModule(module.module_key).length,
          percent: 0,
        },
      })),
      checkpoint: {
        nextTemplateKey: checkpointTemplate?.template_key ?? CHECKPOINT_01_TEMPLATE_KEY,
        status: runtimeState.checkpointEligible ? 'eligible' : 'locked',
        isUnlocked: runtimeState.checkpointEligible,
        requiredCompletedLessons: CHECKPOINT_01_REQUIRED_LESSONS,
        currentCompletedLessons: runtimeState.completedCount,
        latestAttemptId: null,
        latestPercentScore: null,
        unlockedAt: null,
        passedAt: null,
      },
      exam: {
        nextExamSetKey: examSet?.exam_set_key ?? EXAM_SET_01_KEY,
        status: runtimeState.completedCount >= TOTAL_SHARED_CORE_RUNTIME_LESSONS ? 'eligible' : 'locked',
        releaseStage: (examSet?.release_stage as any) ?? null,
        latestAttemptId: null,
        latestPercentScore: null,
        unlockedAt: null,
      },
      intensive750: null,
      updatedAt: new Date().toISOString(),
    };
    dashboardPayload.intensive750 = buildRussianIntensive750Runtime(progress, dashboardPayload, {
      persistedPackageTier: courseEnrollment?.course_type ?? null,
      persistedActivationStatus: courseEnrollment?.activation_status ?? null,
      persistedRequestStatus: courseEnrollment?.request_status ?? null,
      persistedExamNotices,
    });
    if (dashboardPayload.intensive750) {
      dashboardPayload.intensive750 = applyRussianIntensiveAttemptState(dashboardPayload.intensive750, userId, persistedExamNotices, persistedIntensiveAttempts, persistedIntensiveReviewState);
    }
    return dashboardPayload;
  }

  const [profileRes, placementRes, unlocksRes, checkpointAttemptRes, examAttemptRes] = await Promise.all([
    sb.from('russian_learner_readiness_profiles').select('*').eq('user_id', userId).eq('course_id', course.id).maybeSingle(),
    sb.from('russian_placement_results').select('result_payload').eq('user_id', userId).eq('course_id', course.id).order('completed_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('russian_learner_unlocks')
      .select('unlock_type, unlock_source, unlocked_at, assessment_template_id, exam_set_id, module_id, lesson_id, russian_learning_modules(module_key), russian_learning_lessons(lesson_key), russian_assessment_templates(template_key), russian_exam_sets(exam_set_key)')
      .eq('user_id', userId)
      .eq('course_id', course.id),
    Promise.resolve(checkpointAttemptPreview),
    findLatestExamAttempt(userId, course.id),
  ]);

  const profile = profileRes.data;
  const unlockRows = unlocksRes.data || [];
  const checkpointUnlock = unlockRows.find((entry: any) => entry.russian_assessment_templates?.template_key === CHECKPOINT_01_TEMPLATE_KEY);
  const examUnlock = unlockRows.find((entry: any) => entry.russian_exam_sets?.exam_set_key === EXAM_SET_01_KEY);
  const checkpointAttempt = checkpointAttemptRes;
  const examAttempt = examAttemptRes;
  const nextLesson = getNextRuntimeLesson(progress, Boolean(checkpointAttempt?.passed));

  const moduleSummaries = russianRuntimeModules.map((module) => {
    const moduleLessons = lessonsForModule(module.module_key);
    const completedLessons = moduleLessons.filter((lesson) => progress.completedLessons.includes(lesson.slug)).length;
    const unlockRow = unlockRows.find((entry: any) => entry.russian_learning_modules?.module_key === module.module_key);
    const isUnlocked = Boolean(unlockRow);
    const status = completedLessons === moduleLessons.length
      ? 'completed'
      : completedLessons > 0
        ? 'in_progress'
        : isUnlocked
          ? 'unlocked'
          : 'locked';
    return {
      moduleKey: module.module_key,
      title: translateRuntimeModuleTitle(module.module_key),
      ordinal: module.ordinal,
      status,
      isUnlocked,
      completion: {
        completedLessons,
        totalLessons: moduleLessons.length,
        percent: moduleLessons.length ? Math.round((completedLessons / moduleLessons.length) * 100) : 0,
      },
    };
  });

  const checkpointStatus = checkpointAttempt?.passed
    ? 'passed'
    : checkpointUnlock
      ? runtimeState.checkpointEligible ? 'unlocked' : 'eligible'
      : runtimeState.checkpointEligible
        ? 'eligible'
        : 'locked';

  const examStatus = examAttempt?.passed
    ? 'completed'
    : examUnlock
      ? 'unlocked'
      : runtimeState.completedCount >= TOTAL_SHARED_CORE_RUNTIME_LESSONS
        ? 'eligible'
        : 'locked';

  const dashboardPayload: DashboardPayload = {
    runtime: { isDbReady: runtimeMissing.length === 0, missing: runtimeMissing },
    course: {
      courseKey: course.course_key,
      title: translateRuntimeCourseTitle(course.course_key),
      goalType: course.goal_type,
      academicTrack: course.academic_track,
    },
    readiness: {
      profileId: profile?.id ?? '',
      readinessBand: profile?.readiness_band ?? 'emerging',
      overallReadinessScore: profile?.overall_readiness_score ?? 0,
      surfaceDimensions: (profile?.dimensions_json ?? []).slice(0, 3).map((dimension: any) => ({
        dimensionKey: dimension.dimensionKey,
        score: dimension.score,
        band: dimension.band,
      })),
    },
    resume: {
      moduleKey: nextLesson?.module_key ?? null,
      lessonKey: nextLesson?.lesson_key ?? null,
      lessonTitle: translateRuntimeLessonTitle(nextLesson?.lesson_key ?? null),
    },
    modules: moduleSummaries as any,
    checkpoint: {
      nextTemplateKey: checkpointTemplate?.template_key ?? CHECKPOINT_01_TEMPLATE_KEY,
      status: checkpointStatus,
      isUnlocked: checkpointStatus !== 'locked',
      requiredCompletedLessons: CHECKPOINT_01_REQUIRED_LESSONS,
      currentCompletedLessons: runtimeState.completedCount,
      latestAttemptId: checkpointAttempt?.id ?? null,
      latestPercentScore: checkpointAttempt?.percent_score ?? null,
      unlockedAt: checkpointUnlock?.unlocked_at ?? null,
      passedAt: checkpointAttempt?.passed ? checkpointAttempt.submitted_at : null,
    },
    exam: {
      nextExamSetKey: examSet?.exam_set_key ?? EXAM_SET_01_KEY,
      status: examStatus,
      releaseStage: (examSet?.release_stage as any) ?? null,
      latestAttemptId: examAttempt?.id ?? null,
      latestPercentScore: examAttempt?.percent_score ?? null,
      unlockedAt: examUnlock?.unlocked_at ?? null,
    },
    intensive750: null,
    updatedAt: new Date().toISOString(),
  };
  dashboardPayload.intensive750 = buildRussianIntensive750Runtime(progress, dashboardPayload, {
    persistedPackageTier: courseEnrollment?.course_type ?? null,
    persistedActivationStatus: courseEnrollment?.activation_status ?? null,
    persistedRequestStatus: courseEnrollment?.request_status ?? null,
    persistedExamNotices,
  });
  if (dashboardPayload.intensive750) {
    dashboardPayload.intensive750 = applyRussianIntensiveAttemptState(dashboardPayload.intensive750, userId, persistedExamNotices, persistedIntensiveAttempts, persistedIntensiveReviewState);
  }
  return dashboardPayload;
}

export async function getRussianUnlockState(userId: string): Promise<UnlockStatePayload | null> {
  const course = await findCourseId();
  if (!course?.id) {
    return {
      courseKey: RUSSIAN_EXECUTION_PACK_COURSE_KEY,
      modules: russianRuntimeModules.map((module) => ({
        moduleKey: module.module_key,
        isUnlocked: false,
        unlockSource: null,
        unlockedAt: null,
      })),
      lessons: russianRuntimeLessons.map((lesson) => ({
        lessonKey: lesson.lesson_key,
        isUnlocked: false,
        unlockSource: null,
        unlockedAt: null,
      })),
    };
  }
  const { data } = await sb
    .from('russian_learner_unlocks')
    .select('unlock_source, unlocked_at, russian_learning_modules(module_key), russian_learning_lessons(lesson_key)')
    .eq('user_id', userId)
    .eq('course_id', course.id);

  const rows = data || [];
  return {
    courseKey: RUSSIAN_EXECUTION_PACK_COURSE_KEY,
    modules: russianRuntimeModules.map((module) => {
      const row = rows.find((entry: any) => entry.russian_learning_modules?.module_key === module.module_key);
      return {
        moduleKey: module.module_key,
        isUnlocked: Boolean(row),
        unlockSource: row?.unlock_source ?? null,
        unlockedAt: row?.unlocked_at ?? null,
      };
    }),
    lessons: russianRuntimeLessons.map((lesson) => {
      const row = rows.find((entry: any) => entry.russian_learning_lessons?.lesson_key === lesson.lesson_key);
      return {
        lessonKey: lesson.lesson_key,
        isUnlocked: Boolean(row),
        unlockSource: row?.unlock_source ?? null,
        unlockedAt: row?.unlocked_at ?? null,
      };
    }),
  };
}

export function getRussianLessonProgression(lessonSlug: string, options?: { checkpointPassed?: boolean }): LessonProgressionPayload | null {
  const progress = getProgress();
  const lesson = russianRuntimeLessons.find((entry) => entry.slug === lessonSlug);
  if (!lesson) return null;
  const orderedLessons = russianRuntimeLessons;
  const lessonIndex = orderedLessons.findIndex((entry) => entry.slug === lessonSlug);
  const previousLesson = lessonIndex > 0 ? orderedLessons[lessonIndex - 1] : null;
  const completed = progress.completedLessons.includes(lessonSlug);
  const runtimeState = computeRuntimeUnlockState(progress, { checkpointPassed: Boolean(options?.checkpointPassed) });
  const unlocked = completed || runtimeState.unlockedLessonKeys.includes(lesson.lesson_key) || (lessonIndex === 0) || Boolean(previousLesson && progress.completedLessons.includes(previousLesson.slug));
  const sections = (russianSectionsByLessonKey[lesson.lesson_key] || []).map((section) => ({
    sectionKey: section.section_key,
    status: completed ? 'completed' : unlocked ? (section.ordinal === 1 ? 'completed' : section.ordinal === 2 ? 'in_progress' : 'locked') : 'locked',
  }));
  return {
    courseKey: RUSSIAN_EXECUTION_PACK_COURSE_KEY,
    moduleKey: lesson.module_key,
    lessonKey: lesson.lesson_key,
    status: completed ? 'completed' : unlocked ? 'in_progress' : 'locked',
    sectionProgress: sections as any,
    completion: {
      percent: completed ? 100 : unlocked ? 25 : 0,
      completedRequiredSections: completed ? 4 : unlocked ? 1 : 0,
      totalRequiredSections: 4,
    },
    nextLessonKey: orderedLessons[lessonIndex + 1]?.lesson_key ?? null,
    checkpointEligibility: {
      templateKey: CHECKPOINT_01_TEMPLATE_KEY,
      isEligible: runtimeState.checkpointEligible,
      completedLessons: runtimeState.completedCount,
      requiredLessons: CHECKPOINT_01_REQUIRED_LESSONS,
    },
    updatedAt: new Date().toISOString(),
  };
}
