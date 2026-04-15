import { supabase } from '@/integrations/supabase/client';
import {
  getAllRussianIntensiveAssessmentDefinitions,
  getRussianIntensiveAssessmentDefinition,
  type RussianIntensivePersistedAttemptSummary,
} from '@/lib/russianIntensive750AssessmentRuntime';
import type { RussianAssessmentScoringResult } from '@/types/russianAssessmentExecution';
import type { RussianIntensiveStageKey, RussianWeakAreaKey } from '@/types/russianIntensive750';

const sb = supabase as any;

async function findCourseRow() {
  const { data } = await sb
    .from('russian_learning_courses')
    .select('id, course_key')
    .eq('course_key', 'russian_shared_core_v1')
    .maybeSingle();
  return data ?? null;
}

export async function ensureRussianIntensiveExamSetRows() {
  const course = await findCourseRow();
  if (!course?.id) throw new Error('exam_submit_not_ready');

  const rows = getAllRussianIntensiveAssessmentDefinitions().map((definition) => ({
    exam_set_key: definition.examSetKey,
    course_id: course.id,
    title: definition.title,
    exam_family: definition.examFamily,
    track_scope: 'shared_foundation',
    version: definition.version,
    lesson_scope_keys: definition.lessonScopeKeys,
    module_scope_keys: definition.moduleScopeKeys,
    total_sections: definition.totalSections,
    total_items: definition.totalItems,
    target_score: definition.targetScore,
    release_stage: 'active',
    blueprint_json: {
      generated: true,
      examFamily: definition.examFamily,
      weekNumber: definition.weekNumber,
      sections: definition.sections,
    },
    metadata: {
      generated: true,
      intensiveFamily: definition.examFamily,
      weekNumber: definition.weekNumber,
      examSetKey: definition.examSetKey,
    },
  }));

  await sb.from('russian_exam_sets').upsert(rows, { onConflict: 'exam_set_key' });
  return course;
}

export async function getPersistedRussianIntensiveAttemptSummaries(userId: string): Promise<Partial<Record<string, RussianIntensivePersistedAttemptSummary>>> {
  const course = await ensureRussianIntensiveExamSetRows();
  const { data } = await sb
    .from('russian_exam_attempts')
    .select('id, percent_score, passed, submitted_at, attempt_no, russian_exam_sets!inner(exam_set_key)')
    .eq('user_id', userId)
    .eq('course_id', course.id)
    .order('attempt_no', { ascending: false });

  const summaryMap: Partial<Record<string, RussianIntensivePersistedAttemptSummary>> = {};
  for (const row of data ?? []) {
    const examSetKey = row.russian_exam_sets?.exam_set_key;
    if (!examSetKey || summaryMap[examSetKey]) continue;
    summaryMap[examSetKey] = {
      examSetKey,
      attemptId: row.id ?? null,
      percentScore: row.percent_score ?? null,
      passed: row.passed ?? null,
      submittedAt: row.submitted_at ?? null,
      attemptNo: Number(row.attempt_no ?? 0),
    };
  }

  return summaryMap;
}


export interface PersistedRussianIntensiveReviewState {
  hasActiveReview: boolean;
  reviewBlockIds: string[];
  blockingReasons: string[];
  weakAreaKeys: RussianWeakAreaKey[];
  sourceExamKeys: string[];
  latestStageKey: RussianIntensiveStageKey | null;
  latestWeekNumber: number | null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function mapSectionToWeakArea(sectionKey: string): RussianWeakAreaKey {
  if (sectionKey === 'reading') return 'academic_reading';
  if (sectionKey === 'listening_lite') return 'listening_processing';
  if (sectionKey === 'written_response') return 'writing_output';
  return 'core_grammar';
}

export async function getPersistedRussianIntensiveReviewState(userId: string): Promise<PersistedRussianIntensiveReviewState> {
  const course = await ensureRussianIntensiveExamSetRows();
  const { data } = await sb
    .from('russian_intensive_review_states')
    .select('stage_key, week_number, source_exam_key, review_block_ids, blocking_reasons, weak_area_keys, updated_at')
    .eq('user_id', userId)
    .eq('course_id', course.id)
    .eq('review_status', 'active')
    .order('updated_at', { ascending: false });

  const rows = data ?? [];
  return {
    hasActiveReview: rows.length > 0,
    reviewBlockIds: uniqueStrings(rows.flatMap((row: any) => row.review_block_ids ?? [])),
    blockingReasons: uniqueStrings(rows.flatMap((row: any) => row.blocking_reasons ?? [])),
    weakAreaKeys: uniqueStrings(rows.flatMap((row: any) => row.weak_area_keys ?? [])) as RussianWeakAreaKey[],
    sourceExamKeys: uniqueStrings(rows.map((row: any) => row.source_exam_key)),
    latestStageKey: (rows[0]?.stage_key ?? null) as RussianIntensiveStageKey | null,
    latestWeekNumber: typeof rows[0]?.week_number === 'number' ? rows[0].week_number : null,
  };
}

export async function syncPersistedRussianIntensiveReviewState(input: {
  userId: string;
  examSetKey: string;
  examAttemptId: string;
  scoringResult: RussianAssessmentScoringResult;
}) {
  const course = await ensureRussianIntensiveExamSetRows();
  const definition = getRussianIntensiveAssessmentDefinition(input.examSetKey as any);
  if (!definition) return;

  const failedSections = input.scoringResult.sectionScores.filter((section) => !section.passed);
  const reviewBlockIds = failedSections.length > 0
    ? failedSections.map((section) => `${input.examSetKey}_${section.sectionKey}_review`)
    : [`${input.examSetKey}_review`];
  const weakAreaKeys = uniqueStrings(failedSections.map((section) => mapSectionToWeakArea(section.sectionKey))) as RussianWeakAreaKey[];
  const blockingReasons = uniqueStrings([
    `${definition.examFamily}_retry_required`,
    ...failedSections.map((section) => `failed_${section.sectionKey}`),
  ]);
  const stageKey = (definition.moduleScopeKeys[0] ?? 'foundation_bootcamp') as RussianIntensiveStageKey;

  if (input.scoringResult.passed) {
    await sb
      .from('russian_intensive_review_states')
      .update({ review_status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', input.userId)
      .eq('course_id', course.id)
      .eq('source_exam_key', input.examSetKey)
      .eq('review_status', 'active');
    return;
  }

  await sb.from('russian_intensive_review_states').upsert({
    user_id: input.userId,
    course_id: course.id,
    stage_key: stageKey,
    week_number: definition.weekNumber,
    source_exam_key: input.examSetKey,
    source_exam_attempt_id: input.examAttemptId,
    review_status: 'active',
    review_block_ids: reviewBlockIds,
    blocking_reasons: blockingReasons,
    weak_area_keys: weakAreaKeys,
    metadata_json: {
      examFamily: definition.examFamily,
      targetScore: definition.targetScore,
      percentScore: input.scoringResult.percentScore,
      failedSections: failedSections.map((section) => ({
        sectionKey: section.sectionKey,
        percentScore: section.percentScore,
      })),
    },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,course_id,source_exam_key' });
}
