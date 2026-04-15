import type { RussianIntensive750RuntimePayload } from '@/types/russianIntensive750';
import type { RussianPlacementResult } from '@/lib/russianPlacementTypes';

export type GoalType = 'prep_exam' | 'university_study' | 'daily_life';
export type AcademicTrack = 'shared_foundation' | 'academic_core' | 'medicine' | 'engineering' | 'humanities_social';
export type ReadinessBand = 'emerging' | 'building' | 'on_track' | 'ready';
export type PlacementBand = 'start_from_zero' | 'basics_refresh' | 'early_academic' | 'PB0_SCRIPT_FOUNDATION' | 'PB1_GENERAL_FOUNDATION' | 'PB2_GENERAL_CORE' | 'PB3_ACADEMIC_ENTRY' | 'PB4_ACADEMIC_READY_EARLY_TRACK_SIGNAL' | 'PB5_PREP_ACCELERATED_ENTRY';

export interface PlacementDimensionScore {
  dimensionKey: string;
  score: number;
  band: ReadinessBand;
}

export interface PlacementResultOutput extends RussianPlacementResult {
  placementResultId: string;
  courseKey: string;
  attemptNo: number;
  placementBand: PlacementBand;
  rawScore: number;
  normalizedScore: number;
  recommendedCourseKey: string;
  recommendedStartModuleKey: string | null;
  recommendedStartLessonKey: string | null;
  unlocks: {
    moduleKeys: string[];
    lessonKeys: string[];
  };
  dimensionScores: PlacementDimensionScore[];
  dashboardRedirect: {
    dashboardRoute: string;
    resumeModuleKey: string | null;
    resumeLessonKey: string | null;
  };
  completedAt: string;
}

export interface LearnerReadinessDimension {
  dimensionKey: string;
  label: string;
  score: number;
  band: ReadinessBand;
  evidence: {
    placementResultId: string | null;
    latestAssessmentAttemptId: string | null;
    completedLessonCount: number;
  };
}

export interface LearnerReadinessProfilePayload {
  profileId: string;
  userId: string;
  courseKey: string;
  readinessBand: ReadinessBand;
  currentCefrBand: string | null;
  overallReadinessScore: number;
  layerScores: {
    sharedFoundation: number;
    academicCore: number;
    disciplineOverlay: number;
    examReadiness: number;
  };
  dimensions: LearnerReadinessDimension[];
  recommendations: Array<{
    type: 'next_lesson' | 'checkpoint' | 'review';
    targetKey: string;
    reason: string;
  }>;
  calculatedAt: string;
}

export interface DashboardModuleSummary {
  moduleKey: string;
  title: string;
  ordinal: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  isUnlocked: boolean;
  completion: {
    completedLessons: number;
    totalLessons: number;
    percent: number;
  };
}


export interface ExamNotice {
  id: string;
  title: string;
  exam_type: string;
  description: string | null;
  module_coverage: string[] | null;
  scheduled_at: string | null;
  status: string;
  preparation_note: string | null;
  external_link: string | null;
}

export interface DashboardRuntimeStatus {
  isDbReady: boolean;
  missing: string[];
}

export interface DashboardPayload {
  runtime: DashboardRuntimeStatus;
  course: {
    courseKey: string;
    title: string;
    goalType: GoalType;
    academicTrack: AcademicTrack;
  };
  readiness: {
    profileId: string;
    readinessBand: ReadinessBand;
    overallReadinessScore: number;
    surfaceDimensions: PlacementDimensionScore[];
    placementSummary?: RussianPlacementResult | null;
  };
  resume: {
    moduleKey: string | null;
    lessonKey: string | null;
    lessonTitle: string | null;
  };
  modules: DashboardModuleSummary[];
  checkpoint: {
    nextTemplateKey: string | null;
    status: 'locked' | 'eligible' | 'unlocked' | 'passed';
    isUnlocked: boolean;
    requiredCompletedLessons: number;
    currentCompletedLessons: number;
    latestAttemptId: string | null;
    latestPercentScore: number | null;
    unlockedAt: string | null;
    passedAt: string | null;
  };
  exam: {
    nextExamSetKey: string | null;
    status: 'locked' | 'eligible' | 'unlocked' | 'completed';
    releaseStage: 'draft' | 'active' | 'retired' | null;
    latestAttemptId: string | null;
    latestPercentScore: number | null;
    unlockedAt: string | null;
  };
  intensive750: RussianIntensive750RuntimePayload | null;
  updatedAt: string;
}

export interface UnlockStatePayload {
  courseKey: string;
  modules: Array<{
    moduleKey: string;
    isUnlocked: boolean;
    unlockSource: string | null;
    unlockedAt: string | null;
  }>;
  lessons: Array<{
    lessonKey: string;
    isUnlocked: boolean;
    unlockSource: string | null;
    unlockedAt: string | null;
  }>;
}

export interface LessonProgressionPayload {
  courseKey: string;
  moduleKey: string;
  lessonKey: string;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  sectionProgress: Array<{
    sectionKey: string;
    status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  }>;
  completion: {
    percent: number;
    completedRequiredSections: number;
    totalRequiredSections: number;
  };
  nextLessonKey: string | null;
  checkpointEligibility: {
    templateKey: string | null;
    isEligible: boolean;
    completedLessons: number;
    requiredLessons: number;
  };
  updatedAt: string;
}

export interface RussianExecutionPackState {
  course: {
    courseKey: string;
    title: string;
    goalType: GoalType;
    academicTrack: AcademicTrack;
  };
  placement: {
    status: 'idle' | 'loading' | 'resolved';
    result: PlacementResultOutput | null;
  };
  readiness: {
    status: 'idle' | 'loading' | 'ready';
    profileId: string | null;
    readinessBand: ReadinessBand | null;
    overallReadinessScore: number | null;
    dimensions: Array<{
      dimensionKey: string;
      label: string;
      score: number;
      band: ReadinessBand;
    }>;
  };
  dashboard: {
    resumeModuleKey: string | null;
    resumeLessonKey: string | null;
    nextCheckpointTemplateKey: string | null;
    nextExamSetKey: string | null;
  };
  unlocks: {
    moduleKeys: string[];
    lessonKeys: string[];
  };
  progression: {
    byLessonKey: Record<string, {
      status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
      percent: number;
      completedSectionKeys: string[];
      updatedAt: string | null;
    }>;
  };
}
