export type TeacherRoleType = 'language_teacher' | 'curriculum_exam_teacher';

export interface StudentTeacherRole {
  teacherUserId: string;
  teacherName: string | null;
  role: TeacherRoleType;
}

export interface StudentSessionCard {
  id: string;
  status: 'upcoming' | 'live' | 'completed' | 'cancelled';
  scheduledAt: string | null;
  sessionType: string;
  targetLessonSlug: string | null;
  targetModuleSlug: string | null;
  joinLink: string | null;
  summary: string | null;
  nextAction: string | null;
  teacherUserId: string;
  teacherRole: TeacherRoleType;
  teacherName: string | null;
  aiRecapUnlocked: boolean;
}

export interface StudentActionQueueItem {
  id: string;
  type: 'homework' | 'review' | 'checkpoint' | 'session_recovery' | 'exam_recovery' | 'teacher_follow_up';
  titleKey: string;
  dueAt: string | null;
  relatedLessonSlug: string | null;
  priority: 'normal' | 'high' | 'urgent';
}

export interface StudentPlanHealth {
  state: 'on_track' | 'slightly_behind' | 'at_risk' | 'emergency_exam_mode';
  weeklyTargetSessions: number;
  requiredSessionsThisWeek: number;
  recoveryPathActive: boolean;
}

export interface StudentSkillInsight {
  key: 'listening' | 'speaking' | 'reading' | 'writing' | 'vocabulary_retention' | 'checkpoint_readiness' | 'exam_readiness';
  score: number;
  source: 'measured' | 'derived';
  actionKey: string;
}

export interface StudentOperatingSystemData {
  teacherRoles: StudentTeacherRole[];
  sessions: StudentSessionCard[];
  queue: StudentActionQueueItem[];
  planHealth: StudentPlanHealth;
  examCountdownDays: number | null;
  dailyTargetMinutes: number;
  aiRecapUnlockedCount: number;
  attendanceRate: number;
  homeworkCompletionRate: number;
  lessonsCompleted: number;
  lessonsRemaining: number;
  aiRecapUsage: number;
  streakDays: number;
  insights: StudentSkillInsight[];
}
