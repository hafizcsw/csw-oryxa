import type { DashboardPayload, ReadinessBand } from '@/types/russianExecutionPack';

export type RussianCheckpointTemplateKey = 'shared_core_checkpoint_01_v1';
export type RussianIntensiveGeneratedExamKey =
  | `weekly_exam_w${string}`
  | `stage_exam_${string}_w${string}`
  | `milestone_exam_${string}_w${string}`
  | `mock_exam_${string}_w${string}`
  | `final_readiness_gate_w${string}`;
export type RussianExamSetKey = 'shared_core_exam_set_01_v1' | RussianIntensiveGeneratedExamKey;
export type RussianAssessmentExecutionStatus = 'locked' | 'eligible' | 'unlocked' | 'passed' | 'completed';
export type RussianAssessmentSectionKey = 'reading' | 'language_use' | 'listening_lite' | 'written_response';
export type RussianAssessmentScoringMode = 'exact_match' | 'concept_match';

export interface RussianAssessmentLatestAttemptSummary {
  attemptId: string | null;
  percentScore: number | null;
  passed: boolean | null;
  submittedAt: string | null;
}

export interface RussianAssessmentContentBlock {
  blockKey: string;
  type: 'prompt' | 'note' | 'transcript';
  title?: string | null;
  content: string;
}

export interface RussianAssessmentItemScoring {
  mode: RussianAssessmentScoringMode;
  maxPoints: number;
  acceptedAnswers?: string[];
  requiredConceptGroups?: string[][];
  emptyFeedback?: string;
  correctFeedback?: string;
  incorrectFeedback?: string;
}

export interface RussianAssessmentItem {
  itemKey: string;
  ordinal: number;
  lessonKey: string | null;
  lessonTitle: string | null;
  prompt: string;
  promptType: 'short_answer' | 'written_response';
  scoring: RussianAssessmentItemScoring;
}

export interface RussianAssessmentSection {
  key: RussianAssessmentSectionKey;
  titleKey: string;
  title: string;
  itemCount: number;
  contentBlocks?: RussianAssessmentContentBlock[];
  items: RussianAssessmentItem[];
}

export interface RussianCheckpointLaunchPayload {
  courseKey: string;
  templateKey: RussianCheckpointTemplateKey;
  title: string;
  version: string;
  checkpointFamilyKey: string | null;
  status: 'locked' | 'eligible' | 'unlocked' | 'passed';
  requiredCompletedLessons: number;
  currentCompletedLessons: number;
  passingScore: number | null;
  totalItems: number;
  lessonScopeKeys: string[];
  moduleScopeKeys: string[];
  scoringJson: Record<string, unknown>;
  blueprintJson: Record<string, unknown>;
  sections: RussianAssessmentSection[];
  latestAttempt: RussianAssessmentLatestAttemptSummary;
}

export interface RussianExamLaunchPayload {
  courseKey: string;
  examSetKey: RussianExamSetKey;
  title: string;
  version: string;
  examFamily: string;
  status: 'locked' | 'eligible' | 'unlocked' | 'completed';
  releaseStage: 'draft' | 'active' | 'retired';
  targetScore: number;
  totalSections: number;
  totalItems: number;
  lessonScopeKeys: string[];
  moduleScopeKeys: string[];
  blueprintJson: Record<string, unknown>;
  sections: RussianAssessmentSection[];
  latestAttempt: RussianAssessmentLatestAttemptSummary;
  metadata?: {
    generated: boolean;
    intensiveFamily?: string;
    weekNumber?: number;
  };
}

export interface RussianCheckpointSubmitInput {
  templateKey: RussianCheckpointTemplateKey;
  answersJson: Record<string, string>;
  durationSeconds: number;
}

export interface RussianExamSubmitInput {
  examSetKey: RussianExamSetKey;
  answersJson: Record<string, string>;
  durationSeconds: number;
}

export interface RussianAssessmentItemScore {
  itemKey: string;
  earnedPoints: number;
  maxPoints: number;
  isCorrect: boolean;
  answer: string;
  feedback: string;
  scoreSource: RussianAssessmentScoringMode;
  matchedAnswer?: string | null;
  matchedConcepts?: string[];
  conceptTargets?: string[];
}

export interface RussianAssessmentSectionScore {
  sectionKey: RussianAssessmentSectionKey;
  title: string;
  contentBlockCount: number;
  earnedPoints: number;
  maxPoints: number;
  percentScore: number;
  passed: boolean;
  answeredItems: number;
  totalItems: number;
  itemResults: RussianAssessmentItemScore[];
}

export interface RussianAssessmentFeedbackPayload {
  assessmentKind: 'checkpoint' | 'exam';
  assessmentTitle: string;
  scoringMode: string;
  passingScore: number;
  earnedPoints: number;
  maxPoints: number;
  percentScore: number;
  passed: boolean;
  strongestSection: { sectionKey: RussianAssessmentSectionKey; percentScore: number } | null;
  weakestSection: { sectionKey: RussianAssessmentSectionKey; percentScore: number } | null;
  nextSteps: string[];
  incorrectItemCount: number;
  itemFeedback: Array<{ itemKey: string; feedback: string }>;
}

export interface RussianAssessmentScoringResult {
  percentScore: number;
  passed: boolean;
  earnedPoints: number;
  maxPoints: number;
  sectionScores: RussianAssessmentSectionScore[];
  feedback: RussianAssessmentFeedbackPayload;
}

export interface RussianCheckpointSubmitResult {
  attemptId: string;
  percentScore: number;
  passed: boolean;
  submittedAt: string;
  dashboard: DashboardPayload;
  readinessBand: ReadinessBand | null;
}

export interface RussianExamSubmitResult {
  attemptId: string;
  percentScore: number;
  passed: boolean;
  submittedAt: string;
  dashboard: DashboardPayload;
  readinessBand: ReadinessBand | null;
}
