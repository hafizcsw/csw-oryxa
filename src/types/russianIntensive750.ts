import type { AcademicTrack, ReadinessBand } from '@/types/russianExecutionPack';

export type RussianIntensivePackageTier = '250_usd' | '500_usd' | '750_usd';
export type RussianIntensiveStageKey =
  | 'foundation_bootcamp'
  | 'core_beginner_structure'
  | 'academic_core'
  | 'track_overlay'
  | 'intensive_exam_readiness';
export type RussianIntensiveAssessmentKind =
  | 'lesson_check'
  | 'weekly_exam'
  | 'stage_exam'
  | 'milestone_exam'
  | 'mock_exam'
  | 'final_readiness_gate';
export type RussianIntensiveAssessmentBlockingMode = 'non_blocking' | 'review_blocking' | 'hard_blocking';
export type RussianWeakAreaKey =
  | 'script_and_sound'
  | 'core_grammar'
  | 'academic_reading'
  | 'listening_processing'
  | 'writing_output'
  | 'exam_timing'
  | 'track_overlay_transfer';

export interface RussianIntensiveStageDefinition {
  stageKey: RussianIntensiveStageKey;
  stageOrdinal: number;
  lessonRange: { start: number; end: number };
  weekRange: { start: number; end: number };
  objective: string;
  readinessTarget: {
    readinessBand: ReadinessBand;
    minimumScore: number;
    targetCefrBand: string;
  };
  examCheckpointGates: string[];
  unlockRuleToNextStage: string;
}

export interface RussianIntensiveWeeklyRhythm {
  lessonsPerWeek: number;
  targetStudyDays: number;
  vocabularyTarget: {
    newWords: number;
    reviewWords: number;
    retentionTargetPercent: number;
  };
  homeworkExpectation: {
    focusedReviewBlocks: number;
    writingTasks: number;
    listeningTasks: number;
    minimumIndependentStudyMinutes: number;
  };
  examCadence: {
    weeklyExamEveryWeeks: number;
    weeklyExamLessonOffset: number;
    remediationWindowDays: number;
  };
}

export interface RussianIntensiveAssessmentRule {
  assessmentKind: RussianIntensiveAssessmentKind;
  cadence: string;
  blockingMode: RussianIntensiveAssessmentBlockingMode;
  passThresholdPercent: number;
  unlockEffect: string;
  failureEffect: string;
}

export interface RussianIntensivePackageDifferentiation {
  packageTier: RussianIntensivePackageTier;
  deliveryPace: {
    lessonsPerWeek: number;
    weeklyVocabularyTarget: number;
  };
  assessmentPolicy: {
    lessonCheckMode: 'completion' | 'mastery_gate';
    weeklyExamCadence: 'none' | 'biweekly' | 'weekly';
    stageExamCount: number;
    mockExamCount: number;
  };
  reviewPolicy: {
    requiredReviewOnWeakness: boolean;
    reviewUnlockThresholdPercent: number;
    maxRetriesBeforeRepeatWeek: number;
  };
  progressionPolicy: {
    weeklyUnlockMode: 'calendar_based' | 'completion_based' | 'assessment_gated';
    nextStageGate: 'lesson_completion' | 'stage_exam_pass' | 'stage_exam_plus_readiness';
    finalReadinessDepth: 'light' | 'standard' | 'deep';
  };
}

export interface RussianIntensiveDashboardExtension {
  stageKey: RussianIntensiveStageKey;
  stageTitle: string;
  currentWeek: number;
  weekStatus: 'on_track' | 'review_required' | 'blocked_for_exam' | 'ready_to_advance';
  lessonsDueThisWeek: Array<{
    lessonRangeLabel: string;
    lessonNumbers: number[];
    status: 'locked' | 'available' | 'completed' | 'review_required';
  }>;
  weeklyExam: {
    examKey: string;
    status: 'locked' | 'due' | 'passed' | 'retry_required';
    blocking: boolean;
    dueAfterLesson: number;
    weakAreas: RussianWeakAreaKey[];
  };
  stageExam: {
    examKey: string | null;
    status: 'locked' | 'due' | 'passed' | 'retry_required';
    blocking: boolean;
  };
  weakAreas: Array<{
    areaKey: RussianWeakAreaKey;
    label: string;
    severity: 'low' | 'medium' | 'high';
    source: RussianIntensiveAssessmentKind;
  }>;
  requiredReview: {
    reviewBlockIds: string[];
    mustCompleteBeforeAdvance: boolean;
  };
  readinessToAdvance: {
    nextWeekReady: boolean;
    nextStageReady: boolean;
    reasons: string[];
  };
  finalExamReadiness: {
    readinessStatus: 'not_started' | 'building' | 'near_ready' | 'ready';
    completedMockExams: number;
    targetMockExams: number;
  };
}

export interface RussianIntensiveWeeklyStatusContract {
  weekNumber: number;
  stageKey: RussianIntensiveStageKey;
  lessonRange: { start: number; end: number };
  lessonsCompleted: number[];
  weeklyExamKey: string;
  weeklyExamStatus: 'not_due' | 'due' | 'passed' | 'failed' | 'retry_required';
  remediationStatus: 'not_needed' | 'assigned' | 'completed';
  unlockedNextWeek: boolean;
}

export interface RussianIntensiveStageProgress {
  stageKey: RussianIntensiveStageKey;
  stageOrdinal: number;
  stageTitle: string;
  lessonRange: { start: number; end: number };
  weekRange: { start: number; end: number };
  status: 'not_started' | 'in_progress' | 'review_required' | 'completed';
  completedLessonCount: number;
  totalLessons: number;
  progressPercent: number;
  requiredGateKey: string | null;
  nextStageKey: RussianIntensiveStageKey | null;
}

export interface RussianIntensiveWeeklyExamState {
  examKey: string;
  status: 'locked' | 'scheduled' | 'due' | 'passed' | 'retry_required';
  blocking: boolean;
  dueAfterLesson: number;
  attemptsUsed: number;
  maxRetries: number;
  bestScore: number | null;
  passedAt: string | null;
}

export interface RussianIntensiveStageExamState {
  examKey: string | null;
  status: 'locked' | 'scheduled' | 'due' | 'passed' | 'retry_required';
  blocking: boolean;
  requiredScore: number;
  bestScore: number | null;
  passedAt: string | null;
}

export interface RussianIntensiveReviewRequiredState {
  hasRequiredReview: boolean;
  reviewBlockIds: string[];
  blockingReasons: string[];
  weakAreaKeys: RussianWeakAreaKey[];
  persistedSourceExamKeys?: string[];
  persistedStageKey?: RussianIntensiveStageKey | null;
  persistedWeekNumber?: number | null;
}

export interface RussianIntensiveGeneratedExamState {
  examKey: string;
  family: 'milestone_exam' | 'mock_exam' | 'final_readiness_gate';
  status: 'locked' | 'scheduled' | 'due' | 'passed' | 'retry_required';
  targetScore: number;
  attemptsUsed: number;
  bestScore: number | null;
  passedAt: string | null;
  submittedAt: string | null;
  reviewRequired: boolean;
}

export interface RussianIntensiveReadinessState {
  stageKey: RussianIntensiveStageKey;
  overallStatus: 'not_ready' | 'review_required' | 'conditionally_ready' | 'ready';
  readinessScore: number;
  minimumAdvancementScore: number;
  blockingReasons: string[];
  recommendedActions: string[];
  trackContext: {
    activeTrack: AcademicTrack;
    overlayAttached: boolean;
    overlayReadinessScore: number | null;
  };
}

export interface RussianIntensive750RuntimePayload {
  isActive: boolean;
  packageTier: RussianIntensivePackageTier;
  currentLessonNumber: number;
  stageProgress: RussianIntensiveStageProgress;
  weeklyStatus: RussianIntensiveWeeklyStatusContract;
  weeklyExamState: RussianIntensiveWeeklyExamState;
  stageExamState: RussianIntensiveStageExamState;
  reviewRequiredState: RussianIntensiveReviewRequiredState;
  intensiveReadinessState: RussianIntensiveReadinessState;
  generatedExamStates: {
    milestoneExamStates: RussianIntensiveGeneratedExamState[];
    mockExamStates: RussianIntensiveGeneratedExamState[];
    finalReadinessGate: RussianIntensiveGeneratedExamState;
  };
  dashboard: RussianIntensiveDashboardExtension;
}
