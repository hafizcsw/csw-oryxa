import { getLanguageCourseExamRoute } from '@/lib/languageCourseConfig';
import i18n from '@/i18n';
import { translateLanguageCourseValue } from '@/lib/languageCourseI18n';
import { russianIntensive750StageMap } from '@/lib/russianIntensive750Plan';
import type {
  RussianAssessmentLatestAttemptSummary,
  RussianAssessmentSection,
  RussianExamLaunchPayload,
  RussianExamSetKey,
} from '@/types/russianAssessmentExecution';
import type { DashboardPayload, ExamNotice } from '@/types/russianExecutionPack';
import type { PersistedRussianIntensiveReviewState } from '@/lib/russianIntensive750Persistence';
import type { RussianIntensive750RuntimePayload } from '@/types/russianIntensive750';

const STORAGE_PREFIX = 'russian_intensive_750_attempts';
const WEEKLY_PATTERN = /^weekly_exam_w(\d{2})$/;
const STAGE_PATTERN = /^stage_exam_(.+)_w(\d{2})$/;
const MILESTONE_PATTERN = /^milestone_exam_(\d{2})_w(\d{2})$/;
const MOCK_PATTERN = /^mock_exam_(\d{2})_w(\d{2})$/;
const FINAL_PATTERN = /^final_readiness_gate_w(\d{2})$/;

/** Merge two string arrays, keeping only unique values */
function mergeUniqueStrings(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

export function getRussianIntensiveExamRoute(examSetKey: string) {
  return getLanguageCourseExamRoute('russian', examSetKey);
}

export function isPersistedRussianIntensiveExamNotice(notice: Pick<ExamNotice, 'external_link'>) {
  return Boolean(notice.external_link && isRussianIntensiveExamKey(String(notice.external_link).split('/').pop() ?? ''));
}

export interface StoredIntensiveAttempt {
  attemptId: string;
  examSetKey: string;
  percentScore: number;
  passed: boolean;
  submittedAt: string;
  attemptNo: number;
}

export interface IntensiveAssessmentDefinition {
  examSetKey: RussianExamSetKey;
  title: string;
  examFamily: 'weekly_exam' | 'stage_exam' | 'milestone_exam' | 'mock_exam' | 'final_readiness_gate';
  version: string;
  weekNumber: number;
  targetScore: number;
  totalSections: number;
  totalItems: number;
  lessonScopeKeys: string[];
  moduleScopeKeys: string[];
  sections: RussianAssessmentSection[];
}

export interface RussianIntensivePersistedAttemptSummary extends RussianAssessmentLatestAttemptSummary {
  examSetKey: RussianExamSetKey;
  attemptNo: number;
}

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function readAttempts(userId: string): StoredIntensiveAttempt[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAttempts(userId: string, attempts: StoredIntensiveAttempt[]) {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(attempts));
}

export function isRussianIntensiveExamKey(examSetKey: string) {
  return WEEKLY_PATTERN.test(examSetKey) || STAGE_PATTERN.test(examSetKey) || MILESTONE_PATTERN.test(examSetKey) || MOCK_PATTERN.test(examSetKey) || FINAL_PATTERN.test(examSetKey);
}

function localizedStageLabel(stageKey: string) {
  return translateLanguageCourseValue(i18n.t.bind(i18n), `languages.dashboard.intensive.stageKeys.${stageKey}`, stageKey);
}

function buildSections(key: string, label: string, weekNumber: number, stageLabel: string, targetScore: number): RussianAssessmentSection[] {
  return [
    {
      key: 'reading',
      titleKey: 'languages.assessment.sections.reading',
      title: i18n.t('languages.assessment.sections.reading'),
      itemCount: 1,
      contentBlocks: [{ blockKey: `${key}_reading_block`, type: 'note', content: i18n.t('languages.assessment.generated.readingBlock', { label, week: weekNumber, stage: stageLabel }) }],
      items: [{
        itemKey: `${key}_reading_1`,
        ordinal: 1,
        lessonKey: null,
        lessonTitle: null,
        prompt: i18n.t('languages.assessment.generated.stageLabelPrompt', { stage: stageLabel }),
        promptType: 'short_answer',
        scoring: { mode: 'exact_match', maxPoints: 1, acceptedAnswers: [stageLabel], correctFeedback: i18n.t('languages.assessment.generated.stageLabelCorrect') },
      }],
    },
    {
      key: 'language_use',
      titleKey: 'languages.assessment.sections.language_use',
      title: i18n.t('languages.assessment.sections.language_use'),
      itemCount: 1,
      contentBlocks: [{ blockKey: `${key}_language_block`, type: 'note', content: i18n.t('languages.assessment.generated.weekBlock', { week: weekNumber }) }],
      items: [{
        itemKey: `${key}_language_1`,
        ordinal: 1,
        lessonKey: null,
        lessonTitle: null,
        prompt: i18n.t('languages.assessment.generated.weekNumberPrompt'),
        promptType: 'short_answer',
        scoring: { mode: 'exact_match', maxPoints: 1, acceptedAnswers: [String(weekNumber).padStart(2, '0')], correctFeedback: i18n.t('languages.assessment.generated.weekNumberCorrect') },
      }],
    },
    {
      key: 'listening_lite',
      titleKey: 'languages.assessment.sections.listening_lite',
      title: i18n.t('languages.assessment.sections.listening_lite'),
      itemCount: 1,
      contentBlocks: [{ blockKey: `${key}_listening_block`, type: 'transcript', content: i18n.t('languages.assessment.generated.listeningBlock', { label, score: targetScore }) }],
      items: [{
        itemKey: `${key}_listening_1`,
        ordinal: 1,
        lessonKey: null,
        lessonTitle: null,
        prompt: i18n.t('languages.assessment.generated.targetScorePrompt'),
        promptType: 'short_answer',
        scoring: { mode: 'exact_match', maxPoints: 1, acceptedAnswers: [String(targetScore)], correctFeedback: i18n.t('languages.assessment.generated.targetScoreCorrect') },
      }],
    },
    {
      key: 'written_response',
      titleKey: 'languages.assessment.sections.written_response',
      title: i18n.t('languages.assessment.sections.written_response'),
      itemCount: 1,
      contentBlocks: [{ blockKey: `${key}_written_block`, type: 'prompt', content: i18n.t('languages.assessment.generated.writtenBlock') }],
      items: [{
        itemKey: `${key}_written_1`,
        ordinal: 1,
        lessonKey: null,
        lessonTitle: null,
        prompt: i18n.t('languages.assessment.generated.writtenResponsePrompt'),
        promptType: 'written_response',
        scoring: {
          mode: 'concept_match',
          maxPoints: 2,
          requiredConceptGroups: [[stageLabel], [key]],
          correctFeedback: i18n.t('languages.assessment.generated.writtenConceptCorrect'),
          incorrectFeedback: i18n.t('languages.assessment.generated.writtenConceptIncorrect'),
        },
      }],
    },
  ];
}

function buildDefinition(examSetKey: RussianExamSetKey): IntensiveAssessmentDefinition | null {
  const weekly = examSetKey.match(WEEKLY_PATTERN);
  if (weekly) {
    const weekNumber = Number(weekly[1]);
    const stage = russianIntensive750StageMap.find((candidate) => weekNumber >= candidate.weekRange.start && weekNumber <= candidate.weekRange.end) ?? russianIntensive750StageMap[0];
    return {
      examSetKey,
      title: i18n.t('languages.assessment.generated.weeklyExamTitle', { week: weekly[1] }),
      examFamily: 'weekly_exam',
      version: 'v1',
      weekNumber,
      targetScore: 72,
      totalSections: 4,
      totalItems: 4,
      lessonScopeKeys: [`intensive_week_${weekly[1]}`],
      moduleScopeKeys: [stage.stageKey],
      sections: buildSections(examSetKey, i18n.t('languages.assessment.generated.weeklyExamTitle', { week: weekly[1] }), weekNumber, localizedStageLabel(stage.stageKey), 72),
    };
  }

  const stageMatch = examSetKey.match(STAGE_PATTERN);
  if (stageMatch) {
    const weekNumber = Number(stageMatch[2]);
    const stageKey = stageMatch[1];
    const isFoundation = stageKey === 'foundation' || stageKey === 'foundation_bootcamp';
    return {
      examSetKey,
      title: i18n.t('languages.assessment.generated.stageExamTitle', { stage: localizedStageLabel(stageKey) }),
      examFamily: 'stage_exam',
      version: 'v1',
      weekNumber,
      targetScore: isFoundation ? 70 : 75,
      totalSections: 4,
      totalItems: 4,
      lessonScopeKeys: [`intensive_stage_${stageKey}`],
      moduleScopeKeys: [stageKey],
      sections: buildSections(examSetKey, i18n.t('languages.assessment.generated.stageExamTitle', { stage: localizedStageLabel(stageKey) }), weekNumber, localizedStageLabel(stageKey), isFoundation ? 70 : 75),
    };
  }

  const milestone = examSetKey.match(MILESTONE_PATTERN);
  if (milestone) {
    const weekNumber = Number(milestone[2]);
    const stage = russianIntensive750StageMap.find((candidate) => weekNumber >= candidate.weekRange.start && weekNumber <= candidate.weekRange.end) ?? russianIntensive750StageMap[0];
    return {
      examSetKey,
      title: i18n.t('languages.assessment.generated.milestoneExamTitle', { index: milestone[1] }),
      examFamily: 'milestone_exam',
      version: 'v1',
      weekNumber,
      targetScore: 76,
      totalSections: 4,
      totalItems: 4,
      lessonScopeKeys: [`intensive_milestone_${milestone[1]}`],
      moduleScopeKeys: [stage.stageKey],
      sections: buildSections(examSetKey, i18n.t('languages.assessment.generated.milestoneExamTitle', { index: milestone[1] }), weekNumber, localizedStageLabel(stage.stageKey), 76),
    };
  }

  const mock = examSetKey.match(MOCK_PATTERN);
  if (mock) {
    const weekNumber = Number(mock[2]);
    const stage = russianIntensive750StageMap.find((candidate) => weekNumber >= candidate.weekRange.start && weekNumber <= candidate.weekRange.end) ?? russianIntensive750StageMap[4];
    return {
      examSetKey,
      title: i18n.t('languages.assessment.generated.mockExamTitle', { index: mock[1] }),
      examFamily: 'mock_exam',
      version: 'v1',
      weekNumber,
      targetScore: 80,
      totalSections: 4,
      totalItems: 4,
      lessonScopeKeys: [`intensive_mock_${mock[1]}`],
      moduleScopeKeys: [stage.stageKey],
      sections: buildSections(examSetKey, i18n.t('languages.assessment.generated.mockExamTitle', { index: mock[1] }), weekNumber, localizedStageLabel(stage.stageKey), 80),
    };
  }

  const finalGate = examSetKey.match(FINAL_PATTERN);
  if (finalGate) {
    const weekNumber = Number(finalGate[1]);
    return {
      examSetKey,
      title: i18n.t('languages.assessment.generated.finalReadinessGateTitle'),
      examFamily: 'final_readiness_gate',
      version: 'v1',
      weekNumber,
      targetScore: 82,
      totalSections: 4,
      totalItems: 4,
      lessonScopeKeys: ['intensive_final_readiness'],
      moduleScopeKeys: ['intensive_exam_readiness'],
      sections: buildSections(examSetKey, i18n.t('languages.assessment.generated.finalReadinessGateTitle'), weekNumber, localizedStageLabel('intensive_exam_readiness'), 82),
    };
  }

  return null;
}

export function getRussianIntensiveAssessmentDefinition(examSetKey: RussianExamSetKey) {
  return buildDefinition(examSetKey);
}

export function getAllRussianIntensiveAssessmentDefinitions(): IntensiveAssessmentDefinition[] {
  const definitions: IntensiveAssessmentDefinition[] = [];
  for (let week = 1; week <= 20; week += 1) {
    definitions.push(buildDefinition(`weekly_exam_w${String(week).padStart(2, '0')}` as RussianExamSetKey)!);
  }
  definitions.push(buildDefinition('stage_exam_foundation_w04')!);
  definitions.push(buildDefinition('stage_exam_core_beginner_structure_w08')!);
  definitions.push(buildDefinition('stage_exam_academic_core_w13')!);
  definitions.push(buildDefinition('stage_exam_track_overlay_w17')!);
  definitions.push(buildDefinition('milestone_exam_01_w08')!);
  definitions.push(buildDefinition('milestone_exam_02_w13')!);
  definitions.push(buildDefinition('milestone_exam_03_w17')!);
  definitions.push(buildDefinition('mock_exam_01_w19')!);
  definitions.push(buildDefinition('mock_exam_02_w20')!);
  definitions.push(buildDefinition('final_readiness_gate_w20')!);
  return definitions;
}

export function getRussianIntensiveLatestAttempt(userId: string, examSetKey: RussianExamSetKey): RussianAssessmentLatestAttemptSummary & { attemptNo: number } {
  const latest = readAttempts(userId)
    .filter((attempt) => attempt.examSetKey === examSetKey)
    .sort((a, b) => b.attemptNo - a.attemptNo)[0];
  return {
    attemptId: latest?.attemptId ?? null,
    percentScore: latest?.percentScore ?? null,
    passed: latest?.passed ?? null,
    submittedAt: latest?.submittedAt ?? null,
    attemptNo: latest?.attemptNo ?? 0,
  };
}

export function persistRussianIntensiveAttempt(userId: string, attempt: Omit<StoredIntensiveAttempt, 'attemptNo'>) {
  const attempts = readAttempts(userId);
  const nextAttemptNo = attempts.filter((entry) => entry.examSetKey === attempt.examSetKey).length + 1;
  const next = [...attempts, { ...attempt, attemptNo: nextAttemptNo }];
  writeAttempts(userId, next);
  return nextAttemptNo;
}

export function getRussianIntensiveExamStatus(
  examSetKey: RussianExamSetKey,
  dashboard: DashboardPayload,
  latestAttempt?: RussianAssessmentLatestAttemptSummary,
): RussianExamLaunchPayload['status'] {
  const intensive = dashboard.intensive750;
  if (!intensive?.isActive) return 'locked';
  if (latestAttempt?.passed) return 'completed';
  if (examSetKey === intensive.weeklyExamState.examKey) {
    return intensive.weeklyExamState.status === 'due' || intensive.weeklyExamState.status === 'retry_required' ? 'eligible' : 'locked';
  }
  if (examSetKey === intensive.stageExamState.examKey) {
    return intensive.stageExamState.status === 'due' || intensive.stageExamState.status === 'retry_required' ? 'eligible' : 'locked';
  }

  const generatedExamState = [
    ...intensive.generatedExamStates.milestoneExamStates,
    ...intensive.generatedExamStates.mockExamStates,
    intensive.generatedExamStates.finalReadinessGate,
  ].find((candidate) => candidate.examKey === examSetKey);
  if (!generatedExamState) return 'locked';
  return generatedExamState.status === 'due' || generatedExamState.status === 'retry_required' || generatedExamState.status === 'passed'
    ? 'eligible'
    : 'locked';
}

export function getRussianIntensiveAttemptSummary(userId: string, examSetKey: RussianExamSetKey) {
  return getRussianIntensiveLatestAttempt(userId, examSetKey);
}

export function buildRussianIntensiveExamLaunchPayload(
  userId: string,
  examSetKey: RussianExamSetKey,
  dashboard: DashboardPayload,
  persistedAttempts: Partial<Record<string, RussianIntensivePersistedAttemptSummary>> = {},
): RussianExamLaunchPayload | null {
  const definition = buildDefinition(examSetKey);
  if (!definition) return null;
  const persistedAttempt = persistedAttempts[examSetKey] ?? null;
  const localAttempt = getRussianIntensiveLatestAttempt(userId, examSetKey);
  const latestAttempt = persistedAttempt?.attemptId ? persistedAttempt : localAttempt;
  const effectiveStatus = latestAttempt.passed
    ? 'completed'
    : examSetKey === dashboard.intensive750?.weeklyExamState.examKey && dashboard.intensive750.weeklyExamState.status === 'retry_required'
      ? 'unlocked'
      : getRussianIntensiveExamStatus(examSetKey, dashboard, latestAttempt);

  return {
    courseKey: dashboard.course.courseKey,
    examSetKey,
    title: definition.title,
    version: definition.version,
    examFamily: definition.examFamily,
    status: effectiveStatus,
    releaseStage: 'active',
    targetScore: definition.targetScore,
    totalSections: definition.totalSections,
    totalItems: definition.totalItems,
    lessonScopeKeys: definition.lessonScopeKeys,
    moduleScopeKeys: definition.moduleScopeKeys,
    blueprintJson: {
      generated: true,
      examFamily: definition.examFamily,
      weekNumber: definition.weekNumber,
    },
    sections: definition.sections,
    latestAttempt,
    metadata: {
      generated: true,
      intensiveFamily: definition.examFamily,
      weekNumber: definition.weekNumber,
    },
  };
}

export function getRussianIntensiveAttemptForDashboard(userId: string, examSetKey: string) {
  return getRussianIntensiveLatestAttempt(userId, examSetKey as RussianExamSetKey);
}

function mapPersistedNoticeStatus(notice: ExamNotice | null | undefined) {
  if (!notice?.status) return null;
  const status = String(notice.status).toLowerCase();
  if (status === 'completed' || status === 'passed') return 'passed' as const;
  if (status === 'retry_required') return 'retry_required' as const;
  if (status === 'eligible' || status === 'unlocked' || status === 'due') return 'due' as const;
  if (status === 'scheduled' || status === 'upcoming') return 'scheduled' as const;
  return 'locked' as const;
}

function resolveAttemptSummary(
  userId: string,
  examSetKey: RussianExamSetKey,
  persistedAttempts: Partial<Record<string, RussianIntensivePersistedAttemptSummary>>,
) {
  return persistedAttempts[examSetKey] ?? getRussianIntensiveLatestAttempt(userId, examSetKey);
}

function upsertBlockingReason(reasons: string[], reason: string, enabled: boolean) {
  if (!enabled) return reasons;
  return reasons.includes(reason) ? reasons : [...reasons, reason];
}

export function applyRussianIntensiveAttemptState(
  runtime: RussianIntensive750RuntimePayload,
  userId: string,
  persistedExamNotices: ExamNotice[] = [],
  persistedAttempts: Partial<Record<string, RussianIntensivePersistedAttemptSummary>> = {},
  persistedReviewState?: PersistedRussianIntensiveReviewState | null,
): RussianIntensive750RuntimePayload {
  const weeklyAttempt = resolveAttemptSummary(userId, runtime.weeklyExamState.examKey as RussianExamSetKey, persistedAttempts);
  const stageAttempt = runtime.stageExamState.examKey
    ? resolveAttemptSummary(userId, runtime.stageExamState.examKey as RussianExamSetKey, persistedAttempts)
    : null;
  const weeklyNotice = persistedExamNotices.find((notice) => notice.external_link === getRussianIntensiveExamRoute(runtime.weeklyExamState.examKey));
  const stageNotice = runtime.stageExamState.examKey
    ? persistedExamNotices.find((notice) => notice.external_link === getRussianIntensiveExamRoute(runtime.stageExamState.examKey!))
    : null;
  const persistedWeeklyStatus = mapPersistedNoticeStatus(weeklyNotice);
  const persistedStageStatus = mapPersistedNoticeStatus(stageNotice);

  const generatedExamStates = {
    milestoneExamStates: runtime.generatedExamStates.milestoneExamStates.map((exam) => {
      const latest = resolveAttemptSummary(userId, exam.examKey as RussianExamSetKey, persistedAttempts);
      const notice = persistedExamNotices.find((entry) => entry.external_link === getRussianIntensiveExamRoute(exam.examKey));
      const status = mapPersistedNoticeStatus(notice) ?? (latest.passed ? 'passed' : latest.attemptNo > 0 ? 'retry_required' : exam.status);
      return {
        ...exam,
        status,
        attemptsUsed: latest.attemptNo,
        bestScore: latest.percentScore,
        passedAt: latest.passed ? latest.submittedAt : null,
        submittedAt: latest.submittedAt,
        reviewRequired: status === 'retry_required',
      };
    }),
    mockExamStates: runtime.generatedExamStates.mockExamStates.map((exam) => {
      const latest = resolveAttemptSummary(userId, exam.examKey as RussianExamSetKey, persistedAttempts);
      const notice = persistedExamNotices.find((entry) => entry.external_link === getRussianIntensiveExamRoute(exam.examKey));
      const status = mapPersistedNoticeStatus(notice) ?? (latest.passed ? 'passed' : latest.attemptNo > 0 ? 'retry_required' : exam.status);
      return {
        ...exam,
        status,
        attemptsUsed: latest.attemptNo,
        bestScore: latest.percentScore,
        passedAt: latest.passed ? latest.submittedAt : null,
        submittedAt: latest.submittedAt,
        reviewRequired: status === 'retry_required',
      };
    }),
    finalReadinessGate: (() => {
      const exam = runtime.generatedExamStates.finalReadinessGate;
      const latest = resolveAttemptSummary(userId, exam.examKey as RussianExamSetKey, persistedAttempts);
      const notice = persistedExamNotices.find((entry) => entry.external_link === getRussianIntensiveExamRoute(exam.examKey));
      const status = mapPersistedNoticeStatus(notice) ?? (latest.passed ? 'passed' : latest.attemptNo > 0 ? 'retry_required' : exam.status);
      return {
        ...exam,
        status,
        attemptsUsed: latest.attemptNo,
        bestScore: latest.percentScore,
        passedAt: latest.passed ? latest.submittedAt : null,
        submittedAt: latest.submittedAt,
        reviewRequired: status === 'retry_required',
      };
    })(),
  };

  const failedStageOrReadiness = [
    ...generatedExamStates.mockExamStates,
    generatedExamStates.finalReadinessGate,
  ].some((exam) => exam.status === 'retry_required');

  const nextRuntime = {
    ...runtime,
    generatedExamStates,
    weeklyExamState: {
      ...runtime.weeklyExamState,
      status: persistedWeeklyStatus ?? (weeklyAttempt.passed ? 'passed' : weeklyAttempt.attemptNo > 0 ? 'retry_required' : runtime.weeklyExamState.status),
      attemptsUsed: weeklyAttempt.attemptNo,
      bestScore: weeklyAttempt.percentScore,
      passedAt: weeklyAttempt.passed ? weeklyAttempt.submittedAt : null,
    },
    stageExamState: {
      ...runtime.stageExamState,
      status: persistedStageStatus ?? (stageAttempt?.passed ? 'passed' : (stageAttempt?.attemptNo ?? 0) > 0 ? 'retry_required' : runtime.stageExamState.status),
      bestScore: stageAttempt?.percentScore ?? runtime.stageExamState.bestScore,
      passedAt: stageAttempt?.passed ? stageAttempt.submittedAt : runtime.stageExamState.passedAt,
    },
  } satisfies RussianIntensive750RuntimePayload;

  const hasPersistedReview = Boolean(persistedReviewState?.hasActiveReview);
  const hasRequiredReview = nextRuntime.reviewRequiredState.hasRequiredReview
    || nextRuntime.weeklyExamState.status === 'retry_required'
    || nextRuntime.stageExamState.status === 'retry_required'
    || failedStageOrReadiness
    || hasPersistedReview;
  const mockPassedCount = nextRuntime.generatedExamStates.mockExamStates.filter((exam) => exam.status === 'passed').length;
  const nextStageReady = nextRuntime.stageProgress.progressPercent >= 100
    && nextRuntime.intensiveReadinessState.overallStatus === 'ready'
    && (!nextRuntime.stageExamState.examKey || nextRuntime.stageExamState.status === 'passed');
  const weekStatus = hasRequiredReview
    ? 'review_required'
    : nextRuntime.weeklyExamState.status === 'due'
      ? 'blocked_for_exam'
      : nextRuntime.weeklyExamState.status === 'passed'
        ? 'ready_to_advance'
        : nextRuntime.dashboard.weekStatus;

  const blockingReasons = mergeUniqueStrings(
    upsertBlockingReason(
      upsertBlockingReason(
        upsertBlockingReason(nextRuntime.reviewRequiredState.blockingReasons, 'weekly_exam_retry_required', nextRuntime.weeklyExamState.status === 'retry_required'),
        'stage_exam_retry_required', nextRuntime.stageExamState.status === 'retry_required',
      ),
      'final_readiness_retry_required', failedStageOrReadiness,
    ),
    persistedReviewState?.blockingReasons ?? [],
  );

  const readinessActions = hasRequiredReview
    ? ['Complete required review blocks', 'Retry blocking intensive assessment']
    : nextRuntime.intensiveReadinessState.recommendedActions;

  return {
    ...nextRuntime,
    reviewRequiredState: {
      ...nextRuntime.reviewRequiredState,
      hasRequiredReview,
      reviewBlockIds: mergeUniqueStrings(nextRuntime.reviewRequiredState.reviewBlockIds, persistedReviewState?.reviewBlockIds ?? []),
      weakAreaKeys: mergeUniqueStrings(nextRuntime.reviewRequiredState.weakAreaKeys, persistedReviewState?.weakAreaKeys ?? []) as any,
      blockingReasons,
      persistedSourceExamKeys: persistedReviewState?.sourceExamKeys ?? [],
      persistedStageKey: persistedReviewState?.latestStageKey ?? null,
      persistedWeekNumber: persistedReviewState?.latestWeekNumber ?? null,
    },
    intensiveReadinessState: {
      ...nextRuntime.intensiveReadinessState,
      overallStatus: generatedExamStates.finalReadinessGate.status === 'passed' && mockPassedCount >= generatedExamStates.mockExamStates.length && !hasRequiredReview
        ? 'ready'
        : hasRequiredReview
          ? 'review_required'
          : nextRuntime.intensiveReadinessState.overallStatus,
      blockingReasons,
      recommendedActions: readinessActions,
    },
    dashboard: {
      ...nextRuntime.dashboard,
      weekStatus,
      weeklyExam: {
        ...nextRuntime.dashboard.weeklyExam,
        status: nextRuntime.weeklyExamState.status === 'passed' ? 'passed' : nextRuntime.weeklyExamState.status === 'retry_required' ? 'retry_required' : nextRuntime.weeklyExamState.status === 'due' ? 'due' : nextRuntime.dashboard.weeklyExam.status,
      },
      stageExam: {
        ...nextRuntime.dashboard.stageExam,
        status: nextRuntime.stageExamState.status === 'passed' ? 'passed' : nextRuntime.stageExamState.status === 'retry_required' ? 'retry_required' : nextRuntime.stageExamState.status === 'due' ? 'due' : nextRuntime.dashboard.stageExam.status,
      },
      requiredReview: {
        ...nextRuntime.dashboard.requiredReview,
        mustCompleteBeforeAdvance: hasRequiredReview || nextRuntime.dashboard.requiredReview.mustCompleteBeforeAdvance,
      },
      readinessToAdvance: {
        ...nextRuntime.dashboard.readinessToAdvance,
        nextWeekReady: nextRuntime.weeklyExamState.status === 'passed' && !hasRequiredReview,
        nextStageReady,
      },
      finalExamReadiness: {
        ...nextRuntime.dashboard.finalExamReadiness,
        completedMockExams: mockPassedCount,
        readinessStatus: generatedExamStates.finalReadinessGate.status === 'passed' && mockPassedCount >= generatedExamStates.mockExamStates.length
          ? 'ready'
          : mockPassedCount > 0
            ? 'near_ready'
            : nextRuntime.dashboard.finalExamReadiness.readinessStatus,
      },
    },
  };
}
