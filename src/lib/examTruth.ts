import type { ExamNotice } from '@/types/russianExecutionPack';

export type ExamDecisionKey =
  | 'proceed_after_exam'
  | 'retake_exam'
  | 'exam_recovery_required'
  | string
  | null
  | undefined;

type ExamNoticeWithScore = ExamNotice & {
  score?: number | null;
  completed_at?: string | null;
  submitted_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export interface SharedExamTruthInput {
  examNotices: ExamNoticeWithScore[];
  releasedLessonSlugs: string[];
  taughtLessonSlugs: string[];
  nextTeacherDecision?: ExamDecisionKey;
  now?: Date;
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function resolveResultTimestamp(exam: ExamNoticeWithScore): number {
  return (
    toTime(exam.completed_at)
    ?? toTime(exam.submitted_at)
    ?? toTime(exam.updated_at)
    ?? toTime(exam.scheduled_at)
    ?? toTime(exam.created_at)
    ?? 0
  );
}

function normalizeStatus(value: string | null | undefined): string {
  return (value || '').toLowerCase();
}

export function resolveSharedExamTruth(input: SharedExamTruthInput) {
  const nowMs = (input.now || new Date()).getTime();
  const notices = input.examNotices || [];

  const latestResult = notices
    .filter((exam) => typeof exam.score === 'number' || ['completed', 'reviewed', 'passed', 'failed'].includes(normalizeStatus(exam.status)))
    .sort((a, b) => resolveResultTimestamp(b) - resolveResultTimestamp(a))[0] || null;

  const nextExam = notices
    .filter((exam) => {
      const status = normalizeStatus(exam.status);
      const scheduledTs = toTime(exam.scheduled_at);
      if (status === 'cancelled') return false;
      if (scheduledTs === null) return false;
      return scheduledTs >= nowMs;
    })
    .sort((a, b) => (toTime(a.scheduled_at) || Number.MAX_SAFE_INTEGER) - (toTime(b.scheduled_at) || Number.MAX_SAFE_INTEGER))[0] || null;

  const coverage = Array.from(new Set([
    ...input.releasedLessonSlugs.filter(Boolean),
    ...input.taughtLessonSlugs.filter(Boolean),
  ])).slice(0, 8);

  const decision = input.nextTeacherDecision || null;
  const teacherDecisionState = decision === 'exam_recovery_required'
    ? 'recovery'
    : decision === 'retake_exam'
      ? 'retake'
      : decision === 'proceed_after_exam'
        ? 'proceed'
        : null;

  const score = typeof latestResult?.score === 'number' ? latestResult.score : null;
  const derivedState = score === null ? 'retake' : score < 60 ? 'recovery' : 'proceed';

  return {
    latestResult,
    nextExam,
    coverage,
    recoveryState: teacherDecisionState || derivedState,
    teacherDecisionState,
  };
}

export type SharedExamTruth = ReturnType<typeof resolveSharedExamTruth>;
