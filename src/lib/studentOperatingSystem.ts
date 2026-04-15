import type { AssignmentItem, LearningEnrollment, StudyStats } from '@/hooks/useLearningState';
import type { DashboardPayload, ExamNotice } from '@/types/russianExecutionPack';
import type { StudentActionQueueItem, StudentOperatingSystemData, StudentSessionCard, StudentSkillInsight, TeacherRoleType } from '@/types/studentOperatingSystem';

interface TeacherSessionRow {
  id: string;
  status: string;
  scheduled_at: string | null;
  session_type: string;
  lesson_slug: string | null;
  module_slug: string | null;
  zoom_link: string | null;
  summary: string | null;
  next_action: string | null;
  teacher_user_id: string;
}

interface TeacherSessionNoteRow {
  session_id: string;
  summary: string;
  next_action: string | null;
}

interface TeacherEvaluationRow {
  session_id: string;
  understanding_score: number | null;
  confidence_score: number | null;
  participation_score: number | null;
}

interface BuildInput {
  sessions: TeacherSessionRow[];
  sessionNotes: TeacherSessionNoteRow[];
  evaluations: TeacherEvaluationRow[];
  teacherNames: Record<string, string | null>;
  attendanceBySessionId: Record<string, string | null>;
  assignments: AssignmentItem[];
  examNotices: ExamNotice[];
  enrollment: LearningEnrollment | null;
  dashboardData: DashboardPayload | null;
  studyStats: StudyStats;
  completedLessons: number;
  totalLessons: number;
  aiRecapUsage: number;
}

export function mapTeacherRole(sessionType: string): TeacherRoleType {
  const normalized = sessionType.toLowerCase();
  if (normalized.includes('exam') || normalized.includes('checkpoint') || normalized.includes('intensive')) return 'curriculum_exam_teacher';
  return 'language_teacher';
}

function mapSessionStatus(status: string, scheduledAt: string | null): StudentSessionCard['status'] {
  const normalized = status.toLowerCase();
  if (normalized.includes('cancel')) return 'cancelled';
  if (normalized.includes('complete') || normalized.includes('done')) return 'completed';
  if (normalized === 'live' || normalized === 'in_progress') return 'live';
  if (normalized === 'scheduled' || normalized === 'upcoming') return 'upcoming';
  // Never auto-mark old sessions as completed by time alone.
  return 'upcoming';
}

function planHealthState(input: BuildInput): StudentOperatingSystemData['planHealth']['state'] {
  const overdueCount = input.assignments.filter((a) => a.status === 'overdue').length;
  const examDays = getExamCountdownDays(input.examNotices);
  if (examDays !== null && examDays <= 21) return 'emergency_exam_mode';
  if (overdueCount >= 4) return 'at_risk';
  if (overdueCount >= 1) return 'slightly_behind';
  return 'on_track';
}

function getExamCountdownDays(exams: ExamNotice[]): number | null {
  const upcoming = exams
    .filter((exam) => exam.scheduled_at && exam.status.toLowerCase() !== 'cancelled')
    .map((exam) => new Date(exam.scheduled_at as string).getTime())
    .filter((ts) => ts >= Date.now())
    .sort((a, b) => a - b);

  if (!upcoming.length) return null;
  return Math.ceil((upcoming[0] - Date.now()) / 86400000);
}

function buildQueue(assignments: AssignmentItem[], sessions: StudentSessionCard[], checkpointUnlocked: boolean, examDays: number | null): StudentActionQueueItem[] {
  const queue: StudentActionQueueItem[] = [];

  assignments
    .filter((assignment) => ['new', 'in_progress', 'overdue'].includes(assignment.status))
    .forEach((assignment) => {
      queue.push({
        id: `homework-${assignment.id}`,
        type: assignment.status === 'overdue' ? 'session_recovery' : 'homework',
        titleKey: assignment.status === 'overdue' ? 'languages.dashboard.os.queue.overdueHomework' : 'languages.dashboard.os.queue.homework',
        dueAt: assignment.due_date,
        relatedLessonSlug: assignment.lesson_slug,
        priority: assignment.status === 'overdue' ? 'high' : 'normal',
      });
    });

  if (checkpointUnlocked) {
    queue.push({
      id: 'checkpoint-01',
      type: 'checkpoint',
      titleKey: 'languages.dashboard.os.queue.checkpoint',
      dueAt: null,
      relatedLessonSlug: null,
      priority: 'high',
    });
  }

  if (examDays !== null && examDays <= 14) {
    queue.push({
      id: 'exam-recovery',
      type: 'exam_recovery',
      titleKey: 'languages.dashboard.os.queue.examRecovery',
      dueAt: null,
      relatedLessonSlug: null,
      priority: 'urgent',
    });
  }

  sessions
    .filter((session) => session.status === 'completed' && session.nextAction)
    .slice(0, 3)
    .forEach((session) => {
      queue.push({
        id: `followup-${session.id}`,
        type: 'teacher_follow_up',
        titleKey: 'languages.dashboard.os.queue.teacherFollowUp',
        dueAt: session.scheduledAt,
        relatedLessonSlug: session.targetLessonSlug,
        priority: 'normal',
      });
    });

  return queue.sort((a, b) => {
    const priorityRank = { urgent: 0, high: 1, normal: 2 } as const;
    const diff = priorityRank[a.priority] - priorityRank[b.priority];
    if (diff !== 0) return diff;
    const dateA = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return dateA - dateB;
  });
}

function buildInsights(evaluations: TeacherEvaluationRow[], dashboardData: DashboardPayload | null): StudentSkillInsight[] {
  const measuredAvg = (values: Array<number | null>) => {
    const usable = values.filter((value): value is number => typeof value === 'number');
    if (!usable.length) return 0;
    return Math.round(usable.reduce((sum, value) => sum + value, 0) / usable.length);
  };

  const understanding = measuredAvg(evaluations.map((e) => e.understanding_score));
  const confidence = measuredAvg(evaluations.map((e) => e.confidence_score));
  const participation = measuredAvg(evaluations.map((e) => e.participation_score));
  const readiness = dashboardData?.readiness.overallReadinessScore ?? 0;

  return [
    { key: 'listening', score: understanding, source: evaluations.length ? 'measured' : 'derived', actionKey: 'languages.dashboard.os.insights.actions.listening' },
    { key: 'speaking', score: participation, source: evaluations.length ? 'measured' : 'derived', actionKey: 'languages.dashboard.os.insights.actions.speaking' },
    { key: 'reading', score: readiness, source: 'derived', actionKey: 'languages.dashboard.os.insights.actions.reading' },
    { key: 'writing', score: confidence, source: evaluations.length ? 'measured' : 'derived', actionKey: 'languages.dashboard.os.insights.actions.writing' },
    { key: 'vocabulary_retention', score: Math.round((readiness + confidence) / 2), source: 'derived', actionKey: 'languages.dashboard.os.insights.actions.vocabulary' },
    { key: 'checkpoint_readiness', score: dashboardData?.checkpoint.latestPercentScore ?? readiness, source: dashboardData?.checkpoint.latestPercentScore !== null ? 'measured' : 'derived', actionKey: 'languages.dashboard.os.insights.actions.checkpoint' },
    { key: 'exam_readiness', score: dashboardData?.exam.latestPercentScore ?? readiness, source: dashboardData?.exam.latestPercentScore !== null ? 'measured' : 'derived', actionKey: 'languages.dashboard.os.insights.actions.exam' },
  ];
}

export function buildStudentOperatingSystemData(input: BuildInput): StudentOperatingSystemData {
  const noteBySession = new Map(input.sessionNotes.map((note) => [note.session_id, note]));
  // First dedupe hard duplicates by ID
  const uniqueSessions = Array.from(new Map(input.sessions.map((s) => [s.id, s])).values());

  const rawSessionCards: StudentSessionCard[] = uniqueSessions.map((session) => {
    const note = noteBySession.get(session.id);
    const teacherRole = mapTeacherRole(session.session_type);
    const mappedStatus = mapSessionStatus(session.status, session.scheduled_at);

    return {
      id: session.id,
      status: mappedStatus,
      scheduledAt: session.scheduled_at,
      sessionType: session.session_type,
      targetLessonSlug: session.lesson_slug,
      targetModuleSlug: session.module_slug,
      joinLink: session.zoom_link,
      summary: note?.summary ?? session.summary,
      nextAction: note?.next_action ?? session.next_action,
      teacherUserId: session.teacher_user_id,
      teacherRole,
      teacherName: input.teacherNames[session.teacher_user_id] ?? null,
      aiRecapUnlocked: Boolean(note?.summary),
    };
  });

  // Then dedupe logical duplicates (same slot/link/lesson shown twice with different IDs)
  const statusPriority: Record<StudentSessionCard['status'], number> = {
    live: 4,
    upcoming: 3,
    completed: 2,
    cancelled: 1,
  };

  const infoScore = (session: StudentSessionCard) => {
    let score = 0;
    if (session.joinLink) score += 1;
    if (session.summary) score += 1;
    if (session.nextAction) score += 1;
    if (session.aiRecapUnlocked) score += 1;
    return score;
  };

  const byLogicalKey = new Map<string, StudentSessionCard>();
  rawSessionCards.forEach((session) => {
    const logicalKey = [
      session.teacherUserId,
      session.scheduledAt ?? 'no-date',
      session.joinLink ?? 'no-link',
      session.targetLessonSlug ?? 'no-lesson',
      session.targetModuleSlug ?? 'no-module',
    ].join('|');

    const existing = byLogicalKey.get(logicalKey);
    if (!existing) {
      byLogicalKey.set(logicalKey, session);
      return;
    }

    const rankDiff = statusPriority[session.status] - statusPriority[existing.status];
    if (rankDiff > 0 || (rankDiff === 0 && infoScore(session) > infoScore(existing))) {
      byLogicalKey.set(logicalKey, session);
    }
  });

  const sessionCards: StudentSessionCard[] = Array.from(byLogicalKey.values()).sort((a, b) => {
    const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    return dateA - dateB;
  });

  const teacherRoleMap = new Map<string, { name: string | null; role: TeacherRoleType }>();
  sessionCards.forEach((session) => {
    const key = `${session.teacherUserId}:${session.teacherRole}`;
    if (!teacherRoleMap.has(key)) {
      teacherRoleMap.set(key, {
        name: session.teacherName,
        role: session.teacherRole,
      });
    }
  });

  const examCountdownDays = getExamCountdownDays(input.examNotices);
  const queue = buildQueue(input.assignments, sessionCards, input.dashboardData?.checkpoint.isUnlocked ?? false, examCountdownDays);
  const attended = sessionCards.filter((session) => session.status === 'completed').length;
  const totalSessions = sessionCards.filter((session) => session.status !== 'cancelled').length;
  const completedAssignments = input.assignments.filter((assignment) => ['submitted', 'reviewed'].includes(assignment.status)).length;

  return {
    teacherRoles: Array.from(teacherRoleMap.entries()).map(([key, value]) => {
      const [teacherUserId] = key.split(':');
      return { teacherUserId, teacherName: value.name, role: value.role };
    }),
    sessions: sessionCards,
    queue,
    planHealth: {
      state: planHealthState(input),
      weeklyTargetSessions: examCountdownDays !== null && examCountdownDays <= 21 ? 6 : 3,
      requiredSessionsThisWeek: examCountdownDays !== null && examCountdownDays <= 21 ? 5 : 2,
      recoveryPathActive: queue.some((item) => item.type === 'session_recovery' || item.type === 'exam_recovery'),
    },
    examCountdownDays,
    dailyTargetMinutes: input.enrollment?.daily_minutes ?? 30,
    aiRecapUnlockedCount: sessionCards.filter((session) => session.aiRecapUnlocked).length,
    attendanceRate: totalSessions ? Math.round((attended / totalSessions) * 100) : 0,
    homeworkCompletionRate: input.assignments.length ? Math.round((completedAssignments / input.assignments.length) * 100) : 0,
    lessonsCompleted: input.completedLessons,
    lessonsRemaining: Math.max(0, input.totalLessons - input.completedLessons),
    aiRecapUsage: input.aiRecapUsage,
    streakDays: input.studyStats.daysActive,
    insights: buildInsights(input.evaluations, input.dashboardData),
  };
}
