import type { CourseState, LessonProgressionEntry } from '@/hooks/useStudentProgression';
import type { StudentOperatingSystemData } from '@/types/studentOperatingSystem';
import type { AssignmentItem } from '@/hooks/useLearningState';

export type StudentAiScope = 'released_lesson' | 'session_recap' | 'homework' | 'exam_review';

interface Input {
  courseState: CourseState | null;
  releasedLessons: LessonProgressionEntry[];
  data: StudentOperatingSystemData;
  nextAssignment: AssignmentItem | null;
  latestExamScore: number | null;
}

export function resolveStudentAiPolicy(input: Input): {
  allowed: boolean;
  scopes: StudentAiScope[];
  reason: string;
} {
  const scopes = new Set<StudentAiScope>();

  if (input.courseState?.current_lesson_slug && input.releasedLessons.some((l) => l.lesson_slug === input.courseState?.current_lesson_slug)) {
    scopes.add('released_lesson');
  }

  if (input.data.sessions.some((s) => s.aiRecapUnlocked)) {
    scopes.add('session_recap');
  }

  if (input.nextAssignment && ['new', 'in_progress', 'overdue', 'submitted', 'reviewed'].includes(input.nextAssignment.status)) {
    scopes.add('homework');
  }

  if (input.latestExamScore !== null) {
    scopes.add('exam_review');
  }

  if (scopes.size === 0) {
    return {
      allowed: false,
      scopes: [],
      reason: 'blocked_no_released_scope',
    };
  }

  return {
    allowed: true,
    scopes: Array.from(scopes),
    reason: 'allowed_scoped',
  };
}
