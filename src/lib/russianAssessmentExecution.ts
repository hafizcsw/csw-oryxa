import { supabase } from '@/integrations/supabase/client';
import i18n from '@/i18n';
import { translateLanguageCourseValue } from '@/lib/languageCourseI18n';
import {
  buildRussianIntensiveExamLaunchPayload,
  getRussianIntensiveExamRoute,
  isRussianIntensiveExamKey,
  persistRussianIntensiveAttempt,
} from '@/lib/russianIntensive750AssessmentRuntime';
import {
  ensureRussianIntensiveExamSetRows,
  getPersistedRussianIntensiveAttemptSummaries,
  syncPersistedRussianIntensiveReviewState,
} from '@/lib/russianIntensive750Persistence';
import { getRussianDashboardPayload, syncRussianLearnerState } from '@/lib/russianExecutionPackWriters';
import { getRussianLessonByKey } from '@/lib/russianExecutionPackSeed';
import { scoreRussianAssessmentAttempt } from '@/lib/russianAssessmentScoring';
import type {
  RussianAssessmentContentBlock,
  RussianAssessmentItem,
  RussianAssessmentLatestAttemptSummary,
  RussianAssessmentSection,
  RussianCheckpointLaunchPayload,
  RussianCheckpointSubmitInput,
  RussianCheckpointSubmitResult,
  RussianCheckpointTemplateKey,
  RussianExamLaunchPayload,
  RussianExamSetKey,
  RussianExamSubmitInput,
  RussianExamSubmitResult,
} from '@/types/russianAssessmentExecution';

const sb = supabase as any;
const CHECKPOINT_TEMPLATE_KEY: RussianCheckpointTemplateKey = 'shared_core_checkpoint_01_v1';
const EXAM_SET_KEY: RussianExamSetKey = 'shared_core_exam_set_01_v1';
const MIN_ANSWER_LENGTH = 1;

type CourseRow = { id: string; course_key: string };

type AssessmentTemplateRow = {
  id: string;
  template_key: RussianCheckpointTemplateKey;
  course_id: string;
  title: string;
  version: string;
  checkpoint_family_key: string | null;
  passing_score: number | null;
  total_items: number;
  lesson_scope_keys: string[];
  module_scope_keys: string[];
  scoring_json: Record<string, any>;
  blueprint_json: Record<string, any>;
};

type ExamSetRow = {
  id: string;
  exam_set_key: RussianExamSetKey;
  course_id: string;
  title: string;
  version: string;
  exam_family: string;
  release_stage: 'draft' | 'active' | 'retired';
  target_score: number;
  total_sections: number;
  total_items: number;
  lesson_scope_keys: string[];
  module_scope_keys: string[];
  blueprint_json: Record<string, any>;
  metadata?: Record<string, any>;
};

type RawSection = {
  key: string;
  title?: string;
  items?: any[];
  content_blocks?: any[];
};

function normalizeLatestAttempt<T extends { id?: string | null; percent_score?: number | null; passed?: boolean | null; submitted_at?: string | null }>(row?: T | null): RussianAssessmentLatestAttemptSummary {
  return {
    attemptId: row?.id ?? null,
    percentScore: row?.percent_score ?? null,
    passed: row?.passed ?? null,
    submittedAt: row?.submitted_at ?? null,
  };
}

function normalizeContentBlocks(rawBlocks: any[] | undefined): RussianAssessmentContentBlock[] {
  return (rawBlocks ?? []).map((block, index) => ({
    blockKey: String(block?.block_key ?? `block_${index + 1}`),
    type: (block?.type === 'note' || block?.type === 'transcript') ? block.type : 'prompt',
    title: typeof block?.title === 'string' ? block.title : null,
    content: String(block?.content ?? ''),
  }));
}

function normalizeItems(rawItems: any[] | undefined, fallbackLessons: string[]): RussianAssessmentItem[] {
  return (rawItems ?? []).map((item, index) => {
    const lessonKey = String(item?.lesson_key ?? fallbackLessons[index] ?? '') || null;
    const lesson = lessonKey ? getRussianLessonByKey(lessonKey) : null;
    const scoring = item?.scoring ?? {};
    return {
      itemKey: String(item?.item_key ?? `item_${index + 1}`),
      ordinal: index + 1,
      lessonKey,
      lessonTitle: lesson?.lesson_key ? translateLanguageCourseValue(i18n.t.bind(i18n), `languages.runtime.lessons.${lesson.lesson_key}`, lesson.lesson_key) : null,
      prompt: String(item?.prompt ?? ''),
      promptType: item?.prompt_type === 'written_response' ? 'written_response' : 'short_answer',
      scoring: {
        mode: scoring?.mode === 'concept_match' ? 'concept_match' : 'exact_match',
        maxPoints: Number(scoring?.maxPoints ?? 1),
        acceptedAnswers: Array.isArray(scoring?.acceptedAnswers) ? scoring.acceptedAnswers.map(String) : undefined,
        requiredConceptGroups: Array.isArray(scoring?.requiredConceptGroups)
          ? scoring.requiredConceptGroups.map((group: unknown) => Array.isArray(group) ? group.map(String) : [])
          : undefined,
        emptyFeedback: typeof scoring?.emptyFeedback === 'string' ? scoring.emptyFeedback : undefined,
        correctFeedback: typeof scoring?.correctFeedback === 'string' ? scoring.correctFeedback : undefined,
        incorrectFeedback: typeof scoring?.incorrectFeedback === 'string' ? scoring.incorrectFeedback : undefined,
      },
    } satisfies RussianAssessmentItem;
  });
}

function buildAssessmentSections(rawSections: RawSection[] | undefined, fallbackLessonKeys: string[]): RussianAssessmentSection[] {
  return (rawSections ?? []).map((section, sectionIndex) => {
    const normalizedItems = normalizeItems(section.items, fallbackLessonKeys.slice(sectionIndex));
    return {
      key: (section.key || 'reading') as RussianAssessmentSection['key'],
      titleKey: `languages.assessment.sections.${String(section.key || 'reading')}`,
      title: translateLanguageCourseValue(i18n.t.bind(i18n), `languages.assessment.sections.${String(section.key || 'reading')}`, String(section.key || 'reading')),
      itemCount: normalizedItems.length,
      contentBlocks: normalizeContentBlocks(section.content_blocks),
      items: normalizedItems,
    };
  });
}

function buildCheckpointSections(template: AssessmentTemplateRow): RussianAssessmentSection[] {
  return buildAssessmentSections(Array.isArray(template.blueprint_json?.sections) ? template.blueprint_json.sections : [], template.lesson_scope_keys);
}

function buildExamSections(examSet: ExamSetRow): RussianAssessmentSection[] {
  return buildAssessmentSections(Array.isArray(examSet.blueprint_json?.sections) ? examSet.blueprint_json.sections : [], examSet.lesson_scope_keys);
}

async function findCourseRow(): Promise<CourseRow | null> {
  const { data } = await sb
    .from('russian_learning_courses')
    .select('id, course_key')
    .eq('course_key', 'russian_shared_core_v1')
    .maybeSingle();
  return data ?? null;
}

async function findCheckpointTemplateRow(templateKey: RussianCheckpointTemplateKey): Promise<AssessmentTemplateRow | null> {
  const { data } = await sb
    .from('russian_assessment_templates')
    .select('id, template_key, course_id, title, version, checkpoint_family_key, passing_score, total_items, lesson_scope_keys, module_scope_keys, scoring_json, blueprint_json')
    .eq('template_key', templateKey)
    .maybeSingle();
  return data ?? null;
}

async function findExamSetRow(examSetKey: RussianExamSetKey): Promise<ExamSetRow | null> {
  const { data } = await sb
    .from('russian_exam_sets')
    .select('id, exam_set_key, course_id, title, version, exam_family, release_stage, target_score, total_sections, total_items, lesson_scope_keys, module_scope_keys, blueprint_json, metadata')
    .eq('exam_set_key', examSetKey)
    .maybeSingle();
  return data ?? null;
}

async function findLatestCheckpointAttempt(userId: string, courseId: string, templateId: string) {
  const { data } = await sb
    .from('russian_assessment_attempts')
    .select('id, percent_score, passed, submitted_at, attempt_no')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('assessment_template_id', templateId)
    .order('attempt_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function findLatestExamAttempt(userId: string, courseId: string, examSetId: string) {
  const { data } = await sb
    .from('russian_exam_attempts')
    .select('id, percent_score, passed, submitted_at, attempt_no')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('exam_set_id', examSetId)
    .order('attempt_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function findLearningEnrollmentRow(userId: string) {
  const { data } = await sb
    .from('learning_enrollments')
    .select('id')
    .eq('user_id', userId)
    .eq('language', 'russian')
    .maybeSingle();
  return data ?? null;
}

async function syncRussianIntensiveExamNotice(userId: string, payload: RussianExamLaunchPayload, statusOverride?: string) {
  const route = getRussianIntensiveExamRoute(payload.examSetKey);
  const enrollment = await findLearningEnrollmentRow(userId);
  const persistedStatus = statusOverride
    ?? (payload.latestAttempt.passed ? 'passed' : payload.status === 'completed' ? 'passed' : payload.status === 'eligible' || payload.status === 'unlocked' ? 'due' : payload.status);
  const existing = await sb
    .from('learning_exam_notices')
    .select('id')
    .eq('user_id', userId)
    .eq('external_link', route)
    .maybeSingle();

  const notice = {
    user_id: userId,
    enrollment_id: enrollment?.id ?? null,
    title: payload.title,
    description: i18n.t('languages.assessment.intensiveExamNotice', { family: translateLanguageCourseValue(i18n.t.bind(i18n), `languages.assessment.examFamilies.${payload.examFamily}`, payload.examFamily) }),
    exam_type: 'practice',
    module_coverage: payload.moduleScopeKeys,
    scheduled_at: null,
    status: persistedStatus,
    preparation_note: null,
    external_link: route,
  };

  if (existing.data?.id) {
    await sb.from('learning_exam_notices').update(notice).eq('id', existing.data.id);
    return existing.data.id;
  }

  const { data } = await sb.from('learning_exam_notices').insert(notice).select('id').single();
  return data?.id ?? null;
}


async function postSubmitSync(userId: string) {
  await syncRussianLearnerState(userId);
  const dashboard = await getRussianDashboardPayload(userId);
  if (!dashboard) throw new Error('dashboard_refetch_failed');
  return dashboard;
}

export function isCheckpointLaunchAllowed(status?: string | null) {
  return status === 'eligible' || status === 'unlocked' || status === 'passed';
}

export function isExamLaunchAllowed(status?: string | null) {
  return status === 'eligible' || status === 'unlocked' || status === 'completed';
}

export async function getRussianCheckpointLaunchPayload(userId: string, templateKey: RussianCheckpointTemplateKey): Promise<RussianCheckpointLaunchPayload> {
  if (templateKey !== CHECKPOINT_TEMPLATE_KEY) throw new Error('checkpoint_template_not_supported');
  const [course, template, dashboard] = await Promise.all([
    findCourseRow(),
    findCheckpointTemplateRow(templateKey),
    getRussianDashboardPayload(userId),
  ]);

  if (!course?.id || !template?.id || !dashboard) throw new Error('checkpoint_launch_not_ready');
  if (!isCheckpointLaunchAllowed(dashboard.checkpoint.status)) throw new Error('checkpoint_launch_locked');

  const latestAttempt = await findLatestCheckpointAttempt(userId, course.id, template.id);

  return {
    courseKey: course.course_key,
    templateKey: template.template_key,
    title: template.template_key === CHECKPOINT_TEMPLATE_KEY ? i18n.t('languages.assessment.sharedCoreCheckpointTitle') : translateLanguageCourseValue(i18n.t.bind(i18n), `languages.assessment.templates.${template.template_key}`, template.template_key),
    version: template.version,
    checkpointFamilyKey: template.checkpoint_family_key,
    status: dashboard.checkpoint.status,
    requiredCompletedLessons: dashboard.checkpoint.requiredCompletedLessons,
    currentCompletedLessons: dashboard.checkpoint.currentCompletedLessons,
    passingScore: template.passing_score,
    totalItems: template.total_items,
    lessonScopeKeys: template.lesson_scope_keys,
    moduleScopeKeys: template.module_scope_keys,
    scoringJson: template.scoring_json,
    blueprintJson: template.blueprint_json,
    sections: buildCheckpointSections(template),
    latestAttempt: normalizeLatestAttempt(latestAttempt),
  };
}

export async function getRussianExamLaunchPayload(userId: string, examSetKey: RussianExamSetKey): Promise<RussianExamLaunchPayload> {
  const dashboard = await getRussianDashboardPayload(userId);
  if (!dashboard) throw new Error('exam_launch_not_ready');

  if (isRussianIntensiveExamKey(examSetKey)) {
    const persistedAttempts = await getPersistedRussianIntensiveAttemptSummaries(userId);
    const payload = buildRussianIntensiveExamLaunchPayload(userId, examSetKey, dashboard, persistedAttempts);
    if (!payload) throw new Error('exam_set_not_supported');
    if (!isExamLaunchAllowed(payload.status)) throw new Error('exam_launch_locked');
    await syncRussianIntensiveExamNotice(userId, payload);
    return payload;
  }

  if (examSetKey !== EXAM_SET_KEY) throw new Error('exam_set_not_supported');
  const [course, examSet] = await Promise.all([
    findCourseRow(),
    findExamSetRow(examSetKey),
  ]);

  if (!course?.id || !examSet?.id || !dashboard) throw new Error('exam_launch_not_ready');
  if (!isExamLaunchAllowed(dashboard.exam.status)) throw new Error('exam_launch_locked');

  const latestAttempt = await findLatestExamAttempt(userId, course.id, examSet.id);

  return {
    courseKey: course.course_key,
    examSetKey: examSet.exam_set_key,
    title: examSet.exam_set_key === EXAM_SET_KEY ? i18n.t('languages.assessment.sharedCoreExamTitle') : translateLanguageCourseValue(i18n.t.bind(i18n), `languages.assessment.examSets.${examSet.exam_set_key}`, examSet.exam_set_key),
    version: examSet.version,
    examFamily: examSet.exam_family,
    status: dashboard.exam.status,
    releaseStage: examSet.release_stage,
    targetScore: examSet.target_score,
    totalSections: examSet.total_sections,
    totalItems: examSet.total_items,
    lessonScopeKeys: examSet.lesson_scope_keys,
    moduleScopeKeys: examSet.module_scope_keys,
    blueprintJson: examSet.blueprint_json,
    sections: buildExamSections(examSet),
    latestAttempt: normalizeLatestAttempt(latestAttempt),
  };
}

function trimAnswerMap(answersJson: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(answersJson).map(([itemKey, value]) => [itemKey, value.trim()])
  );
}

function answeredCount(answersJson: Record<string, string>) {
  return Object.values(answersJson).filter((value) => value.trim().length >= MIN_ANSWER_LENGTH).length;
}

export async function submitRussianCheckpointAttempt(userId: string, input: RussianCheckpointSubmitInput): Promise<RussianCheckpointSubmitResult> {
  const [course, template, launchPayload] = await Promise.all([
    findCourseRow(),
    findCheckpointTemplateRow(input.templateKey),
    getRussianCheckpointLaunchPayload(userId, input.templateKey),
  ]);
  if (!course?.id || !template?.id) throw new Error('checkpoint_submit_not_ready');

  const latestAttempt = await findLatestCheckpointAttempt(userId, course.id, template.id);
  const normalizedAnswers = trimAnswerMap(input.answersJson);
  const scoringResult = scoreRussianAssessmentAttempt({
    assessmentKind: 'checkpoint',
    title: template.title,
    sections: launchPayload.sections,
    answersJson: normalizedAnswers,
    passingScore: template.passing_score,
  });
  const submittedAt = new Date().toISOString();

  const { data } = await sb
    .from('russian_assessment_attempts')
    .insert({
      user_id: userId,
      course_id: course.id,
      assessment_template_id: template.id,
      status: 'graded',
      score: scoringResult.earnedPoints,
      percent_score: scoringResult.percentScore,
      passed: scoringResult.passed,
      attempt_no: Number(latestAttempt?.attempt_no ?? 0) + 1,
      duration_seconds: Math.max(0, Math.round(input.durationSeconds)),
      answers_json: normalizedAnswers,
      dimension_scores_json: scoringResult.sectionScores,
      section_scores_json: scoringResult.sectionScores,
      feedback_json: {
        ...scoringResult.feedback,
        answeredItems: answeredCount(normalizedAnswers),
        totalItems: launchPayload.totalItems,
      },
      submitted_at: submittedAt,
    })
    .select('id, percent_score, passed, submitted_at')
    .single();

  const dashboard = await postSubmitSync(userId);
  return {
    attemptId: data.id,
    percentScore: data.percent_score,
    passed: Boolean(data.passed),
    submittedAt: data.submitted_at,
    dashboard,
    readinessBand: dashboard.readiness.readinessBand,
  };
}

export async function submitRussianExamAttempt(userId: string, input: RussianExamSubmitInput): Promise<RussianExamSubmitResult> {
  const launchPayload = await getRussianExamLaunchPayload(userId, input.examSetKey);
  if (isRussianIntensiveExamKey(input.examSetKey)) {
    const course = await ensureRussianIntensiveExamSetRows();
    const examSet = await findExamSetRow(input.examSetKey);
    const normalizedAnswers = trimAnswerMap(input.answersJson);
    const scoringResult = scoreRussianAssessmentAttempt({
      assessmentKind: 'exam',
      title: launchPayload.title,
      sections: launchPayload.sections,
      answersJson: normalizedAnswers,
      passingScore: launchPayload.targetScore,
    });
    const submittedAt = new Date().toISOString();
    if (!examSet?.id) throw new Error('exam_submit_not_ready');
    const latestAttempt = await findLatestExamAttempt(userId, course.id, examSet.id);
    const { data } = await sb
      .from('russian_exam_attempts')
      .insert({
        user_id: userId,
        course_id: course.id,
        exam_set_id: examSet.id,
        status: 'graded',
        score: scoringResult.earnedPoints,
        percent_score: scoringResult.percentScore,
        readiness_band: null,
        passed: scoringResult.passed,
        attempt_no: Number(latestAttempt?.attempt_no ?? 0) + 1,
        duration_seconds: Math.max(0, Math.round(input.durationSeconds)),
        section_scores_json: scoringResult.sectionScores,
        answers_json: normalizedAnswers,
        review_json: {
          ...scoringResult.feedback,
          answeredItems: answeredCount(normalizedAnswers),
          totalItems: launchPayload.totalItems,
        },
        feedback_json: {
          ...scoringResult.feedback,
          answeredItems: answeredCount(normalizedAnswers),
          totalItems: launchPayload.totalItems,
        },
        submitted_at: submittedAt,
      })
      .select('id, percent_score, passed, submitted_at')
      .single();
    persistRussianIntensiveAttempt(userId, {
      attemptId: data.id,
      examSetKey: input.examSetKey,
      percentScore: data.percent_score,
      passed: Boolean(data.passed),
      submittedAt: data.submitted_at,
    });
    await syncPersistedRussianIntensiveReviewState({
      userId,
      examSetKey: input.examSetKey,
      examAttemptId: data.id,
      scoringResult,
    });
    await syncRussianIntensiveExamNotice(userId, launchPayload, scoringResult.passed ? 'passed' : 'retry_required');
    const dashboard = await postSubmitSync(userId);
    return {
      attemptId: data.id,
      percentScore: data.percent_score,
      passed: Boolean(data.passed),
      submittedAt: data.submitted_at,
      dashboard,
      readinessBand: dashboard.readiness.readinessBand,
    };
  }

  const [course, examSet] = await Promise.all([
    findCourseRow(),
    findExamSetRow(input.examSetKey),
  ]);
  if (!course?.id || !examSet?.id) throw new Error('exam_submit_not_ready');

  const latestAttempt = await findLatestExamAttempt(userId, course.id, examSet.id);
  const normalizedAnswers = trimAnswerMap(input.answersJson);
  const scoringResult = scoreRussianAssessmentAttempt({
    assessmentKind: 'exam',
    title: launchPayload.title,
    sections: launchPayload.sections,
    answersJson: normalizedAnswers,
    passingScore: examSet.target_score,
  });
  const submittedAt = new Date().toISOString();

  const { data } = await sb
    .from('russian_exam_attempts')
    .insert({
      user_id: userId,
      course_id: course.id,
      exam_set_id: examSet.id,
      status: 'graded',
      score: scoringResult.earnedPoints,
      percent_score: scoringResult.percentScore,
      readiness_band: null,
      passed: scoringResult.passed,
      attempt_no: Number(latestAttempt?.attempt_no ?? 0) + 1,
      duration_seconds: Math.max(0, Math.round(input.durationSeconds)),
      section_scores_json: scoringResult.sectionScores,
      answers_json: normalizedAnswers,
      review_json: {
        ...scoringResult.feedback,
        answeredItems: answeredCount(normalizedAnswers),
        totalItems: launchPayload.totalItems,
      },
      feedback_json: {
        ...scoringResult.feedback,
        answeredItems: answeredCount(normalizedAnswers),
        totalItems: launchPayload.totalItems,
      },
      submitted_at: submittedAt,
    })
    .select('id, percent_score, passed, submitted_at')
    .single();

  const dashboard = await postSubmitSync(userId);
  return {
    attemptId: data.id,
    percentScore: data.percent_score,
    passed: Boolean(data.passed),
    submittedAt: data.submitted_at,
    dashboard,
    readinessBand: dashboard.readiness.readinessBand,
  };
}
