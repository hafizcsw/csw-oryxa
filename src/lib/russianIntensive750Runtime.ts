import { getLanguageCourseExamRoute } from '@/lib/languageCourseConfig';
import i18n from '@/i18n';
import { translateLanguageCourseValue } from '@/lib/languageCourseI18n';
import { getStoredRussianOnboarding } from '@/lib/russianPathState';
import { getRussianIntensive750ProofOverride, resolveRussianIntensiveProofLessonNumber } from '@/lib/russianIntensive750ProofSupport';
import { russianSeedLessons } from '@/lib/russianExecutionPackSeed';
import {
  RUSSIAN_INTENSIVE_750_LESSONS_PER_WEEK,
  RUSSIAN_INTENSIVE_750_TOTAL_LESSONS,
  russianIntensive750StageMap,
} from '@/lib/russianIntensive750Plan';
import type { LearningProgress } from '@/lib/russianCourse';
import type { DashboardPayload, ExamNotice, PlacementDimensionScore } from '@/types/russianExecutionPack';
import type {
  RussianIntensive750RuntimePayload,
  RussianIntensiveDashboardExtension,
  RussianIntensiveGeneratedExamState,
  RussianIntensiveReadinessState,
  RussianIntensiveReviewRequiredState,
  RussianIntensiveStageExamState,
  RussianIntensiveStageKey,
  RussianIntensiveStageProgress,
  RussianIntensiveWeeklyExamState,
  RussianIntensiveWeeklyStatusContract,
  RussianWeakAreaKey,
} from '@/types/russianIntensive750';

const INTENSIVE_ELIGIBLE_TIMELINES = new Set(['3_months', '1_month']);
const INTENSIVE_ELIGIBLE_GOALS = new Set(['prep_exam', 'university_study']);
const WEAK_AREA_LABELS: Record<RussianWeakAreaKey, string> = {
  script_and_sound: 'Script & sound',
  core_grammar: 'Core grammar',
  academic_reading: 'Academic reading',
  listening_processing: 'Listening processing',
  writing_output: 'Writing output',
  exam_timing: 'Exam timing',
  track_overlay_transfer: 'Track overlay transfer',
};
const DIMENSION_TO_WEAK_AREA: Record<string, RussianWeakAreaKey> = {
  alphabet_script_control: 'script_and_sound',
  pronunciation_sound_mapping: 'script_and_sound',
  everyday_interaction: 'core_grammar',
  classroom_comprehension: 'academic_reading',
  reading_patterns: 'academic_reading',
  academic_writing: 'writing_output',
  listening_note_capture: 'listening_processing',
  exam_checkpoint_readiness: 'exam_timing',
};

type RuntimeOptions = {
  persistedPackageTier?: string | null;
  persistedActivationStatus?: string | null;
  persistedRequestStatus?: string | null;
  persistedExamNotices?: ExamNotice[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function titleFromStageKey(stageKey: RussianIntensiveStageKey) {
  return translateLanguageCourseValue(i18n.t.bind(i18n), `languages.dashboard.intensive.stageKeys.${stageKey}`, stageKey);
}

function getCurrentLessonNumber(progress: LearningProgress) {
  const completedContentLessons = russianSeedLessons.filter((lesson) =>
    lesson.lesson_type === 'content' && progress.completedLessons.includes(lesson.slug)
  ).length;
  return clamp(completedContentLessons + 1, 1, RUSSIAN_INTENSIVE_750_TOTAL_LESSONS);
}

function inferIntensiveMode() {
  const onboarding = getStoredRussianOnboarding() as Record<string, unknown> | null;
  const goal = String(onboarding?.goal ?? '').toLowerCase();
  const timeline = String(onboarding?.timeline ?? '').toLowerCase();
  const dailyMinutes = Number(onboarding?.dailyMinutes ?? onboarding?.daily_minutes ?? 0);

  return INTENSIVE_ELIGIBLE_GOALS.has(goal) && INTENSIVE_ELIGIBLE_TIMELINES.has(timeline) && dailyMinutes >= 45;
}

function getWeakAreaKeys(surfaceDimensions: PlacementDimensionScore[]): RussianWeakAreaKey[] {
  const weakAreaKeys = surfaceDimensions
    .filter((dimension) => dimension.score < 65)
    .map((dimension) => DIMENSION_TO_WEAK_AREA[dimension.dimensionKey] ?? 'core_grammar');
  return Array.from(new Set(weakAreaKeys));
}

function buildStageProgress(currentLessonNumber: number, weakAreaKeys: RussianWeakAreaKey[]): RussianIntensiveStageProgress {
  const stage = russianIntensive750StageMap.find((candidate) => currentLessonNumber >= candidate.lessonRange.start && currentLessonNumber <= candidate.lessonRange.end)
    ?? russianIntensive750StageMap[0];
  const completedWithinStage = clamp(currentLessonNumber - stage.lessonRange.start, 0, stage.lessonRange.end - stage.lessonRange.start + 1);
  const totalLessons = stage.lessonRange.end - stage.lessonRange.start + 1;
  const progressPercent = Math.round((completedWithinStage / totalLessons) * 100);

  return {
    stageKey: stage.stageKey,
    stageOrdinal: stage.stageOrdinal,
    stageTitle: titleFromStageKey(stage.stageKey),
    lessonRange: stage.lessonRange,
    weekRange: stage.weekRange,
    status: weakAreaKeys.length > 0 && completedWithinStage > 0 ? 'review_required' : progressPercent >= 100 ? 'completed' : completedWithinStage > 0 ? 'in_progress' : 'not_started',
    completedLessonCount: completedWithinStage,
    totalLessons,
    progressPercent,
    requiredGateKey: stage.examCheckpointGates.at(-1) ?? null,
    nextStageKey: russianIntensive750StageMap.find((candidate) => candidate.stageOrdinal === stage.stageOrdinal + 1)?.stageKey ?? null,
  };
}

function buildWeeklyStatus(currentLessonNumber: number, weakAreaKeys: RussianWeakAreaKey[]): RussianIntensiveWeeklyStatusContract {
  const weekNumber = clamp(Math.ceil(currentLessonNumber / RUSSIAN_INTENSIVE_750_LESSONS_PER_WEEK), 1, 20);
  const weekLessonStart = (weekNumber - 1) * RUSSIAN_INTENSIVE_750_LESSONS_PER_WEEK + 1;
  const weekLessonEnd = weekLessonStart + RUSSIAN_INTENSIVE_750_LESSONS_PER_WEEK - 1;
  const completedInWeek = Array.from({ length: RUSSIAN_INTENSIVE_750_LESSONS_PER_WEEK }, (_, index) => weekLessonStart + index)
    .filter((lessonNumber) => lessonNumber < currentLessonNumber);

  return {
    weekNumber,
    stageKey: russianIntensive750StageMap.find((candidate) => weekNumber >= candidate.weekRange.start && weekNumber <= candidate.weekRange.end)?.stageKey ?? 'foundation_bootcamp',
    lessonRange: { start: weekLessonStart, end: weekLessonEnd },
    lessonsCompleted: completedInWeek,
    weeklyExamKey: `weekly_exam_w${String(weekNumber).padStart(2, '0')}`,
    weeklyExamStatus: completedInWeek.length >= 6 ? weakAreaKeys.length > 0 ? 'retry_required' : 'due' : 'not_due',
    remediationStatus: weakAreaKeys.length > 0 ? 'assigned' : 'not_needed',
    unlockedNextWeek: completedInWeek.length >= 6 && weakAreaKeys.length === 0,
  };
}

function buildWeeklyExamState(weeklyStatus: RussianIntensiveWeeklyStatusContract): RussianIntensiveWeeklyExamState {
  return {
    examKey: weeklyStatus.weeklyExamKey,
    status: weeklyStatus.weeklyExamStatus === 'not_due'
      ? 'scheduled'
      : weeklyStatus.weeklyExamStatus === 'retry_required'
        ? 'retry_required'
        : weeklyStatus.weeklyExamStatus === 'passed'
          ? 'passed'
          : 'due',
    blocking: true,
    dueAfterLesson: weeklyStatus.lessonRange.end,
    attemptsUsed: weeklyStatus.weeklyExamStatus === 'retry_required' ? 1 : 0,
    maxRetries: 2,
    bestScore: null,
    passedAt: null,
  };
}

function buildStageExamState(stageProgress: RussianIntensiveStageProgress, dashboard: DashboardPayload): RussianIntensiveStageExamState {
  const isFoundationStage = stageProgress.stageKey === 'foundation_bootcamp';
  const requiredScore = isFoundationStage ? 70 : 75;
  if (!isFoundationStage) {
    return {
      examKey: stageProgress.requiredGateKey,
      status: stageProgress.progressPercent >= 100 ? 'scheduled' : 'locked',
      blocking: true,
      requiredScore,
      bestScore: null,
      passedAt: null,
    };
  }

  return {
    examKey: 'stage_exam_foundation_w04',
    status: dashboard.checkpoint.status === 'passed'
      ? 'passed'
      : dashboard.checkpoint.status === 'eligible' || dashboard.checkpoint.status === 'unlocked'
        ? 'due'
        : stageProgress.progressPercent >= 100
          ? 'scheduled'
          : 'locked',
    blocking: true,
    requiredScore,
    bestScore: dashboard.checkpoint.latestPercentScore,
    passedAt: dashboard.checkpoint.passedAt,
  };
}

function buildGeneratedExamStates(stageProgress: RussianIntensiveStageProgress, weeklyStatus: RussianIntensiveWeeklyStatusContract): RussianIntensive750RuntimePayload['generatedExamStates'] {
  const mockExamStates: RussianIntensiveGeneratedExamState[] = [
    {
      examKey: 'mock_exam_01_w19',
      family: 'mock_exam',
      status: weeklyStatus.weekNumber >= 19 ? 'due' : 'locked',
      targetScore: 80,
      attemptsUsed: 0,
      bestScore: null,
      passedAt: null,
      submittedAt: null,
      reviewRequired: false,
    },
    {
      examKey: 'mock_exam_02_w20',
      family: 'mock_exam',
      status: weeklyStatus.weekNumber >= 20 ? 'due' : 'locked',
      targetScore: 80,
      attemptsUsed: 0,
      bestScore: null,
      passedAt: null,
      submittedAt: null,
      reviewRequired: false,
    },
  ];

  const finalReadinessGate: RussianIntensiveGeneratedExamState = {
    examKey: 'final_readiness_gate_w20',
    family: 'final_readiness_gate',
    status: weeklyStatus.weekNumber >= 20 ? 'due' : 'locked',
    targetScore: 82,
    attemptsUsed: 0,
    bestScore: null,
    passedAt: null,
    submittedAt: null,
    reviewRequired: false,
  };

  const milestoneExamStates: RussianIntensiveGeneratedExamState[] = [
    { examKey: 'milestone_exam_01_w08', family: 'milestone_exam', status: weeklyStatus.weekNumber >= 8 ? 'due' : 'locked', targetScore: 76, attemptsUsed: 0, bestScore: null, passedAt: null, submittedAt: null, reviewRequired: false },
    { examKey: 'milestone_exam_02_w13', family: 'milestone_exam', status: weeklyStatus.weekNumber >= 13 ? 'due' : 'locked', targetScore: 76, attemptsUsed: 0, bestScore: null, passedAt: null, submittedAt: null, reviewRequired: false },
    { examKey: 'milestone_exam_03_w17', family: 'milestone_exam', status: weeklyStatus.weekNumber >= 17 ? 'due' : 'locked', targetScore: 76, attemptsUsed: 0, bestScore: null, passedAt: null, submittedAt: null, reviewRequired: false },
  ];

  return {
    milestoneExamStates,
    mockExamStates,
    finalReadinessGate,
  };
}

function buildReviewRequiredState(surfaceDimensions: PlacementDimensionScore[], weeklyStatus: RussianIntensiveWeeklyStatusContract, dashboard: DashboardPayload): RussianIntensiveReviewRequiredState {
  const weakAreaKeys = getWeakAreaKeys(surfaceDimensions);
  const blockingReasons = [
    ...(weakAreaKeys.length > 0 ? ['weak_readiness_dimensions'] : []),
    ...(dashboard.checkpoint.latestPercentScore !== null && dashboard.checkpoint.latestPercentScore < 70 ? ['checkpoint_below_stage_threshold'] : []),
    ...(weeklyStatus.weeklyExamStatus === 'retry_required' ? ['weekly_exam_retry_required'] : []),
  ];

  return {
    hasRequiredReview: blockingReasons.length > 0,
    reviewBlockIds: weakAreaKeys.map((key, index) => `intensive_review_${weeklyStatus.weekNumber}_${index + 1}_${key}`),
    blockingReasons,
    weakAreaKeys,
  };
}

function buildIntensiveReadinessState(stageProgress: RussianIntensiveStageProgress, reviewRequiredState: RussianIntensiveReviewRequiredState, dashboard: DashboardPayload): RussianIntensiveReadinessState {
  const readinessScore = dashboard.readiness.overallReadinessScore;
  const minimumAdvancementScore = russianIntensive750StageMap.find((stage) => stage.stageKey === stageProgress.stageKey)?.readinessTarget.minimumScore ?? 42;
  const overallStatus = readinessScore >= minimumAdvancementScore && !reviewRequiredState.hasRequiredReview
    ? 'ready'
    : reviewRequiredState.hasRequiredReview
      ? 'review_required'
      : 'conditionally_ready';

  return {
    stageKey: stageProgress.stageKey,
    overallStatus,
    readinessScore,
    minimumAdvancementScore,
    blockingReasons: reviewRequiredState.blockingReasons,
    recommendedActions: reviewRequiredState.hasRequiredReview
      ? ['Complete required review blocks', 'Clear current weekly exam gate']
      : ['Continue current lesson sequence'],
    trackContext: {
      activeTrack: dashboard.course.academicTrack,
      overlayAttached: stageProgress.stageOrdinal >= 4,
      overlayReadinessScore: stageProgress.stageOrdinal >= 4 ? readinessScore : null,
    },
  };
}

function buildDashboardExtension(
  stageProgress: RussianIntensiveStageProgress,
  weeklyStatus: RussianIntensiveWeeklyStatusContract,
  weeklyExamState: RussianIntensiveWeeklyExamState,
  stageExamState: RussianIntensiveStageExamState,
  reviewRequiredState: RussianIntensiveReviewRequiredState,
  intensiveReadinessState: RussianIntensiveReadinessState,
  generatedExamStates: RussianIntensive750RuntimePayload['generatedExamStates'],
): RussianIntensiveDashboardExtension {
  const lessonNumbers = Array.from({ length: weeklyStatus.lessonRange.end - weeklyStatus.lessonRange.start + 1 }, (_, index) => weeklyStatus.lessonRange.start + index);
  const completedMockExams = generatedExamStates.mockExamStates.filter((exam) => exam.status === 'passed').length;
  return {
    stageKey: stageProgress.stageKey,
    stageTitle: stageProgress.stageTitle,
    currentWeek: weeklyStatus.weekNumber,
    weekStatus: reviewRequiredState.hasRequiredReview
      ? 'review_required'
      : weeklyStatus.unlockedNextWeek
        ? 'ready_to_advance'
        : weeklyExamState.status === 'due'
          ? 'blocked_for_exam'
          : 'on_track',
    lessonsDueThisWeek: lessonNumbers.map((lessonNumber) => ({
      lessonRangeLabel: `L${lessonNumber}`,
      lessonNumbers: [lessonNumber],
      status: weeklyStatus.lessonsCompleted.includes(lessonNumber)
        ? 'completed'
        : reviewRequiredState.hasRequiredReview && lessonNumber === weeklyStatus.lessonRange.end
          ? 'review_required'
          : 'available',
    })),
    weeklyExam: {
      examKey: weeklyExamState.examKey,
      status: weeklyExamState.status === 'scheduled' ? 'locked' : weeklyExamState.status === 'retry_required' ? 'retry_required' : weeklyExamState.status === 'passed' ? 'passed' : 'due',
      blocking: weeklyExamState.blocking,
      dueAfterLesson: weeklyExamState.dueAfterLesson,
      weakAreas: reviewRequiredState.weakAreaKeys,
    },
    stageExam: {
      examKey: stageExamState.examKey,
      status: stageExamState.status === 'scheduled' ? 'locked' : stageExamState.status === 'retry_required' ? 'retry_required' : stageExamState.status === 'passed' ? 'passed' : stageExamState.status === 'due' ? 'due' : 'locked',
      blocking: stageExamState.blocking,
    },
    weakAreas: reviewRequiredState.weakAreaKeys.map((areaKey) => ({
      areaKey,
      label: WEAK_AREA_LABELS[areaKey],
      severity: 'high' as const,
      source: 'lesson_check' as const,
    })),
    requiredReview: {
      reviewBlockIds: reviewRequiredState.reviewBlockIds,
      mustCompleteBeforeAdvance: reviewRequiredState.hasRequiredReview,
    },
    readinessToAdvance: {
      nextWeekReady: weeklyStatus.unlockedNextWeek && !reviewRequiredState.hasRequiredReview,
      nextStageReady: stageProgress.progressPercent >= 100 && intensiveReadinessState.overallStatus === 'ready',
      reasons: reviewRequiredState.blockingReasons.length > 0 ? reviewRequiredState.blockingReasons : ['Continue current week'],
    },
    finalExamReadiness: {
      readinessStatus: intensiveReadinessState.overallStatus === 'ready' ? 'ready' : intensiveReadinessState.readinessScore >= 75 ? 'near_ready' : 'building',
      completedMockExams,
      targetMockExams: generatedExamStates.mockExamStates.length,
    },
  };
}

function hasPersistedIntensiveEnrollment(options?: RuntimeOptions) {
  const packageSignal = options?.persistedPackageTier?.toLowerCase() ?? null;
  const activationStatus = options?.persistedActivationStatus?.toLowerCase() ?? null;
  const requestStatus = options?.persistedRequestStatus?.toLowerCase() ?? null;

  if (!packageSignal) return null;
  const isIntensivePackage = packageSignal === 'intensive_exam' || packageSignal === '750_usd' || packageSignal === 'intensive';
  const isRejected = activationStatus === 'rejected' || requestStatus === 'rejected';
  const isApprovedish = activationStatus === 'active' || activationStatus === 'completed' || requestStatus === 'approved' || requestStatus === 'submitted' || requestStatus === 'under_review';

  if (!isIntensivePackage) return false;
  if (isRejected) return false;
  return isApprovedish || !activationStatus || !requestStatus;
}

function derivePersistedExamStatus(notices: ExamNotice[] | undefined, examKey: string | null) {
  if (!examKey) return null;
  const route = getLanguageCourseExamRoute('russian', examKey);
  const match = notices?.find((notice) => notice.external_link === route) ?? null;
  if (!match?.status) return null;
  const status = String(match.status).toLowerCase();
  if (status === 'completed' || status === 'passed') return 'passed' as const;
  if (status === 'retry_required') return 'retry_required' as const;
  if (status === 'eligible' || status === 'unlocked' || status === 'due') return 'due' as const;
  if (status === 'scheduled' || status === 'upcoming') return 'scheduled' as const;
  return 'locked' as const;
}

export function buildRussianIntensive750Runtime(
  progress: LearningProgress,
  dashboard: DashboardPayload,
  options?: RuntimeOptions,
): RussianIntensive750RuntimePayload | null {
  const persistedEnrollmentTruth = hasPersistedIntensiveEnrollment(options);
  const persistedIntensive = persistedEnrollmentTruth === true;
  const fallbackIntensive = persistedEnrollmentTruth === null ? inferIntensiveMode() : false;
  if (!persistedIntensive && !fallbackIntensive) return null;

  const proofOverride = getRussianIntensive750ProofOverride();
  const currentLessonNumber = resolveRussianIntensiveProofLessonNumber(proofOverride, getCurrentLessonNumber(progress));
  const weakAreaKeys = getWeakAreaKeys(dashboard.readiness.surfaceDimensions);
  const stageProgress = buildStageProgress(currentLessonNumber, weakAreaKeys);
  const weeklyStatus = buildWeeklyStatus(currentLessonNumber, weakAreaKeys);
  const weeklyExamState = buildWeeklyExamState(weeklyStatus);
  const stageExamState = buildStageExamState(stageProgress, dashboard);
  const generatedExamStates = buildGeneratedExamStates(stageProgress, weeklyStatus);

  const persistedWeeklyStatus = derivePersistedExamStatus(options?.persistedExamNotices, weeklyExamState.examKey);
  const persistedStageStatus = derivePersistedExamStatus(options?.persistedExamNotices, stageExamState.examKey);
  if (persistedWeeklyStatus) weeklyExamState.status = persistedWeeklyStatus;
  if (persistedStageStatus) stageExamState.status = persistedStageStatus;

  const reviewRequiredState = buildReviewRequiredState(dashboard.readiness.surfaceDimensions, weeklyStatus, dashboard);
  const intensiveReadinessState = buildIntensiveReadinessState(stageProgress, reviewRequiredState, dashboard);
  const dashboardExtension = buildDashboardExtension(
    stageProgress,
    weeklyStatus,
    weeklyExamState,
    stageExamState,
    reviewRequiredState,
    intensiveReadinessState,
    generatedExamStates,
  );

  return {
    isActive: true,
    packageTier: '750_usd',
    currentLessonNumber,
    stageProgress,
    weeklyStatus,
    weeklyExamState,
    stageExamState,
    reviewRequiredState,
    intensiveReadinessState,
    generatedExamStates,
    dashboard: dashboardExtension,
  };
}
