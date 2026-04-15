import type {
  RussianIntensiveAssessmentRule,
  RussianIntensiveDashboardExtension,
  RussianIntensivePackageDifferentiation,
  RussianIntensiveStageDefinition,
  RussianIntensiveWeeklyRhythm,
  RussianIntensiveWeeklyStatusContract,
} from '@/types/russianIntensive750';

export const RUSSIAN_INTENSIVE_750_PROGRAM_KEY = 'russian_intensive_750_v1';
export const RUSSIAN_INTENSIVE_750_TOTAL_LESSONS = 120;
export const RUSSIAN_INTENSIVE_750_TOTAL_WEEKS = 20;
export const RUSSIAN_INTENSIVE_750_LESSONS_PER_WEEK = 6;

export const russianIntensive750StageMap: RussianIntensiveStageDefinition[] = [
  {
    stageKey: 'foundation_bootcamp',
    stageOrdinal: 1,
    lessonRange: { start: 1, end: 24 },
    weekRange: { start: 1, end: 4 },
    objective: 'Stabilize script, sound decoding, survival interaction, and day-one study stamina for the accelerated track.',
    readinessTarget: { readinessBand: 'building', minimumScore: 42, targetCefrBand: 'A0+' },
    examCheckpointGates: ['weekly_exam_w01', 'weekly_exam_w02', 'weekly_exam_w03', 'stage_exam_foundation_w04'],
    unlockRuleToNextStage: 'Unlock Core Beginner Structure only after lessons 1-24 are complete, weekly exams 1-4 are cleared, and the foundation stage exam passes at 70%+. ',
  },
  {
    stageKey: 'core_beginner_structure',
    stageOrdinal: 2,
    lessonRange: { start: 25, end: 48 },
    weekRange: { start: 5, end: 8 },
    objective: 'Move from survival Russian into reliable sentence building, case awareness, and controlled reading/listening routines.',
    readinessTarget: { readinessBand: 'building', minimumScore: 55, targetCefrBand: 'A1' },
    examCheckpointGates: ['weekly_exam_w05', 'weekly_exam_w06', 'weekly_exam_w07', 'stage_exam_core_beginner_w08', 'milestone_exam_01_w08'],
    unlockRuleToNextStage: 'Unlock Academic Core only after lessons 25-48 are complete, weak-area remediation is closed, Stage 2 exam passes at 72%+, and Milestone 01 passes at 74%+. ',
  },
  {
    stageKey: 'academic_core',
    stageOrdinal: 3,
    lessonRange: { start: 49, end: 78 },
    weekRange: { start: 9, end: 13 },
    objective: 'Build academic reading, lecture-note response, paragraph writing, and discipline-neutral academic operating habits.',
    readinessTarget: { readinessBand: 'on_track', minimumScore: 68, targetCefrBand: 'A1+' },
    examCheckpointGates: ['weekly_exam_w09', 'weekly_exam_w10', 'weekly_exam_w11', 'weekly_exam_w12', 'weekly_exam_w13', 'stage_exam_academic_core_w13', 'milestone_exam_02_w13'],
    unlockRuleToNextStage: 'Unlock Track Overlay only after lessons 49-78 are complete, Stage 3 exam passes at 75%+, Milestone 02 passes at 76%+, and academic writing/listening weak areas are not high severity.',
  },
  {
    stageKey: 'track_overlay',
    stageOrdinal: 4,
    lessonRange: { start: 79, end: 102 },
    weekRange: { start: 14, end: 17 },
    objective: 'Attach future discipline overlays while keeping the shared-core execution lane intact and raising transfer into track vocabulary/tasks.',
    readinessTarget: { readinessBand: 'on_track', minimumScore: 78, targetCefrBand: 'A2-' },
    examCheckpointGates: ['weekly_exam_w14', 'weekly_exam_w15', 'weekly_exam_w16', 'weekly_exam_w17', 'stage_exam_track_overlay_w17', 'milestone_exam_03_w17'],
    unlockRuleToNextStage: 'Unlock Intensive Exam Readiness only after lessons 79-102 are complete, overlay transfer remediation is complete, Stage 4 exam passes at 78%+, and Milestone 03 passes at 80%+. ',
  },
  {
    stageKey: 'intensive_exam_readiness',
    stageOrdinal: 5,
    lessonRange: { start: 103, end: 120 },
    weekRange: { start: 18, end: 20 },
    objective: 'Convert the 120-lesson run into exam readiness through timed practice, mock exams, error compression, and final readiness gating.',
    readinessTarget: { readinessBand: 'ready', minimumScore: 86, targetCefrBand: 'A2' },
    examCheckpointGates: ['weekly_exam_w18', 'weekly_exam_w19', 'weekly_exam_w20', 'mock_exam_01_w19', 'mock_exam_02_w20', 'final_readiness_gate_w20'],
    unlockRuleToNextStage: 'Program completion requires lessons 103-120 complete, both mock exams submitted, final readiness gate passed at 82%+, and no unresolved review-blocking weak area.',
  },
];

export const russianIntensive750WeeklyRhythm: RussianIntensiveWeeklyRhythm = {
  lessonsPerWeek: 6,
  targetStudyDays: 6,
  vocabularyTarget: {
    newWords: 45,
    reviewWords: 90,
    retentionTargetPercent: 82,
  },
  homeworkExpectation: {
    focusedReviewBlocks: 3,
    writingTasks: 2,
    listeningTasks: 2,
    minimumIndependentStudyMinutes: 300,
  },
  examCadence: {
    weeklyExamEveryWeeks: 1,
    weeklyExamLessonOffset: 6,
    remediationWindowDays: 3,
  },
};

export const russianIntensive750AssessmentCadence: RussianIntensiveAssessmentRule[] = [
  {
    assessmentKind: 'lesson_check',
    cadence: 'Every lesson at section completion.',
    blockingMode: 'review_blocking',
    passThresholdPercent: 80,
    unlockEffect: 'Unlocks the next lesson when required sections and lesson check are complete.',
    failureEffect: 'Assigns targeted review; next lesson unlock stays open only after review completion within the same week.',
  },
  {
    assessmentKind: 'weekly_exam',
    cadence: 'End of every week after lesson 6 of the week.',
    blockingMode: 'hard_blocking',
    passThresholdPercent: 72,
    unlockEffect: 'Unlocks the next week and updates weak-area severity.',
    failureEffect: 'Locks next week, assigns remediation bundle, and requires exam retry within the review window.',
  },
  {
    assessmentKind: 'stage_exam',
    cadence: 'End of weeks 4, 8, 13, and 17.',
    blockingMode: 'hard_blocking',
    passThresholdPercent: 70,
    unlockEffect: 'Unlocks the next stage when weekly exam obligations are also clear.',
    failureEffect: 'Repeats the stage review week and blocks stage advancement until the learner passes.',
  },
  {
    assessmentKind: 'milestone_exam',
    cadence: 'End of weeks 8, 13, and 17.',
    blockingMode: 'review_blocking',
    passThresholdPercent: 74,
    unlockEffect: 'Confirms cumulative retention and lifts conditional-ready status.',
    failureEffect: 'Allows stage access only in conditional mode with mandatory remediation attached to the next week.',
  },
  {
    assessmentKind: 'mock_exam',
    cadence: 'Weeks 19 and 20.',
    blockingMode: 'hard_blocking',
    passThresholdPercent: 80,
    unlockEffect: 'Advances final readiness depth and clears final readiness gate prerequisites.',
    failureEffect: 'Schedules intensive review lane and requires a retake before final completion.',
  },
  {
    assessmentKind: 'final_readiness_gate',
    cadence: 'Program close in week 20.',
    blockingMode: 'hard_blocking',
    passThresholdPercent: 82,
    unlockEffect: 'Marks the learner final-ready for the intensive Russian track.',
    failureEffect: 'Program stays in review-required completion state until readiness is restored.',
  },
];

export const russianIntensivePackageDifferentiation: RussianIntensivePackageDifferentiation[] = [
  {
    packageTier: '250_usd',
    deliveryPace: { lessonsPerWeek: 3, weeklyVocabularyTarget: 24 },
    assessmentPolicy: {
      lessonCheckMode: 'completion',
      weeklyExamCadence: 'none',
      stageExamCount: 2,
      mockExamCount: 0,
    },
    reviewPolicy: {
      requiredReviewOnWeakness: false,
      reviewUnlockThresholdPercent: 60,
      maxRetriesBeforeRepeatWeek: 0,
    },
    progressionPolicy: {
      weeklyUnlockMode: 'calendar_based',
      nextStageGate: 'lesson_completion',
      finalReadinessDepth: 'light',
    },
  },
  {
    packageTier: '500_usd',
    deliveryPace: { lessonsPerWeek: 4, weeklyVocabularyTarget: 32 },
    assessmentPolicy: {
      lessonCheckMode: 'mastery_gate',
      weeklyExamCadence: 'biweekly',
      stageExamCount: 4,
      mockExamCount: 1,
    },
    reviewPolicy: {
      requiredReviewOnWeakness: true,
      reviewUnlockThresholdPercent: 68,
      maxRetriesBeforeRepeatWeek: 1,
    },
    progressionPolicy: {
      weeklyUnlockMode: 'completion_based',
      nextStageGate: 'stage_exam_pass',
      finalReadinessDepth: 'standard',
    },
  },
  {
    packageTier: '750_usd',
    deliveryPace: { lessonsPerWeek: 6, weeklyVocabularyTarget: 45 },
    assessmentPolicy: {
      lessonCheckMode: 'mastery_gate',
      weeklyExamCadence: 'weekly',
      stageExamCount: 4,
      mockExamCount: 2,
    },
    reviewPolicy: {
      requiredReviewOnWeakness: true,
      reviewUnlockThresholdPercent: 75,
      maxRetriesBeforeRepeatWeek: 2,
    },
    progressionPolicy: {
      weeklyUnlockMode: 'assessment_gated',
      nextStageGate: 'stage_exam_plus_readiness',
      finalReadinessDepth: 'deep',
    },
  },
];

export const russianIntensive750WeekMap = Array.from({ length: RUSSIAN_INTENSIVE_750_TOTAL_WEEKS }, (_, index) => {
  const weekNumber = index + 1;
  const lessonStart = index * RUSSIAN_INTENSIVE_750_LESSONS_PER_WEEK + 1;
  const lessonEnd = lessonStart + RUSSIAN_INTENSIVE_750_LESSONS_PER_WEEK - 1;
  const stage = russianIntensive750StageMap.find((candidate) => weekNumber >= candidate.weekRange.start && weekNumber <= candidate.weekRange.end)!;
  const weeklyExamKey = `weekly_exam_w${String(weekNumber).padStart(2, '0')}`;
  const stageExamKey = weekNumber === stage.weekRange.end && stage.stageKey !== 'intensive_exam_readiness'
    ? `stage_exam_${stage.stageKey}_w${String(weekNumber).padStart(2, '0')}`
    : null;
  const milestoneExamKey = [8, 13, 17].includes(weekNumber)
    ? `milestone_exam_${weekNumber === 8 ? '01' : weekNumber === 13 ? '02' : '03'}_w${String(weekNumber).padStart(2, '0')}`
    : null;
  const mockExamKey = weekNumber === 19 ? 'mock_exam_01_w19' : weekNumber === 20 ? 'mock_exam_02_w20' : null;
  const finalReadinessGateKey = weekNumber === 20 ? 'final_readiness_gate_w20' : null;

  return {
    weekNumber,
    stageKey: stage.stageKey,
    lessonRange: { start: lessonStart, end: lessonEnd },
    checkpointGate: stageExamKey,
    weeklyExamKey,
    milestoneExamKey,
    mockExamKey,
    finalReadinessGateKey,
    branchOverlayAttachment: weekNumber >= 14 ? 'track_overlay_active' : 'shared_core_only',
  };
});

export const russianIntensive750DashboardContractExample: RussianIntensiveDashboardExtension = {
  stageKey: 'academic_core',
  stageTitle: 'Academic Core',
  currentWeek: 10,
  weekStatus: 'review_required',
  lessonsDueThisWeek: [
    { lessonRangeLabel: 'L55-L56', lessonNumbers: [55, 56], status: 'completed' },
    { lessonRangeLabel: 'L57-L58', lessonNumbers: [57, 58], status: 'available' },
    { lessonRangeLabel: 'L59-L60', lessonNumbers: [59, 60], status: 'review_required' },
  ],
  weeklyExam: {
    examKey: 'weekly_exam_w10',
    status: 'due',
    blocking: true,
    dueAfterLesson: 60,
    weakAreas: ['academic_reading', 'writing_output'],
  },
  stageExam: {
    examKey: null,
    status: 'locked',
    blocking: true,
  },
  weakAreas: [
    { areaKey: 'academic_reading', label: 'Academic reading', severity: 'high', source: 'weekly_exam' },
    { areaKey: 'writing_output', label: 'Writing output', severity: 'medium', source: 'lesson_check' },
  ],
  requiredReview: {
    reviewBlockIds: ['review_w10_reading_01', 'review_w10_writing_01'],
    mustCompleteBeforeAdvance: true,
  },
  readinessToAdvance: {
    nextWeekReady: false,
    nextStageReady: false,
    reasons: ['Weekly exam not yet passed', 'High-severity academic reading weakness remains open'],
  },
  finalExamReadiness: {
    readinessStatus: 'building',
    completedMockExams: 0,
    targetMockExams: 2,
  },
};

export const russianIntensive750WeeklyStatusExample: RussianIntensiveWeeklyStatusContract = {
  weekNumber: 10,
  stageKey: 'academic_core',
  lessonRange: { start: 55, end: 60 },
  lessonsCompleted: [55, 56, 57, 58],
  weeklyExamKey: 'weekly_exam_w10',
  weeklyExamStatus: 'retry_required',
  remediationStatus: 'assigned',
  unlockedNextWeek: false,
};
