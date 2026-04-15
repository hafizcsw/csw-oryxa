import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, PlayCircle, Clock3 } from 'lucide-react';
import { SessionCountdownGated } from '@/components/ui/SessionCountdownGated';
import { useLanguage } from '@/contexts/LanguageContext';
import type { StudentOperatingSystemData } from '@/types/studentOperatingSystem';
import type { DashboardPayload, ExamNotice } from '@/types/russianExecutionPack';
import { DSButton } from '@/components/design-system/DSButton';
import type { AssignmentItem } from '@/hooks/useLearningState';
import type { CourseState, LessonProgressionEntry } from '@/hooks/useStudentProgression';
import type { SharedExamTruth } from '@/lib/examTruth';
import { cn } from '@/lib/utils';

interface Props {
  data: StudentOperatingSystemData;
  dashboardData: DashboardPayload | null | undefined;
  onTabChange?: (tab: string) => void;
  assignmentsPending: number;
  nextAssignment: AssignmentItem | null;
  nextExam: ExamNotice | null;
  courseState: CourseState | null;
  releasedLessons: LessonProgressionEntry[];
  examTruth?: SharedExamTruth;
  isTeacherControlled: boolean;
  getLessonStatus?: (lessonSlug: string) => string;
  /** When true, show only Session + Current Lesson (no homework/exam/messages/progress) */
  compact?: boolean;
}

export function StudentOperatingSystemPanel({
  data, dashboardData, onTabChange, courseState, examTruth, getLessonStatus, compact,
}: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const DEFAULT_DURATION_MS = 60 * 60 * 1000;
  const nextSession = useMemo(() => {
    return data.sessions.find((s) => {
      if (s.status === 'live') return true;
      if (s.status !== 'upcoming') return false;
      // Only show if session hasn't ended yet
      if (!s.scheduledAt) return true;
      const endTime = new Date(s.scheduledAt).getTime() + DEFAULT_DURATION_MS;
      return Date.now() < endTime;
    }) ?? null;
  }, [data.sessions]);
  const currentModule = dashboardData?.resume.moduleKey ?? null;
  const currentLesson = dashboardData?.resume.lessonTitle ?? dashboardData?.resume.lessonKey ?? null;
  const currentReleasedLesson = courseState?.current_lesson_slug ?? currentLesson;
  const currentReleasedModule = courseState?.current_module_slug ?? currentModule;
  const currentLessonStatus = currentReleasedLesson ? (getLessonStatus?.(currentReleasedLesson) ?? 'released') : 'locked';

  const healthColor = {
    on_track: 'bg-emerald-500',
    slightly_behind: 'bg-amber-500',
    at_risk: 'bg-orange-500',
    emergency_exam_mode: 'bg-rose-500',
  }[data.planHealth.state] || 'bg-muted-foreground';

  const healthTextColor = {
    on_track: 'text-emerald-600 dark:text-emerald-400',
    slightly_behind: 'text-amber-600 dark:text-amber-400',
    at_risk: 'text-orange-600 dark:text-orange-400',
    emergency_exam_mode: 'text-rose-600 dark:text-rose-400',
  }[data.planHealth.state] || 'text-muted-foreground';

  return (
    <div className="space-y-4">
      {/* ═══ Status header ═══ */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <span className={cn("inline-block w-2.5 h-2.5 rounded-full", healthColor)} />
          <span className="text-sm font-semibold text-foreground">
            {dashboardData?.course.title || t('languages.catalog.russian.name')}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className={cn("text-xs font-medium", healthTextColor)}>
            {t(`languages.dashboard.os.planHealth.${data.planHealth.state}`)}
          </span>
        </div>
        {data.streakDays > 0 && (
          <span className="text-xs text-muted-foreground font-medium">
            🔥 {t('languages.dashboard.os.metrics.streakValue', { days: data.streakDays })}
          </span>
        )}
      </div>

      {/* ═══ LIVE/UPCOMING SESSION ═══ */}
      {nextSession && (
        <div className={cn(
          "rounded-2xl p-5 space-y-3 transition-all",
          nextSession.status === 'live'
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-500 shadow-lg shadow-emerald-500/10'
            : 'bg-card border border-primary/20 shadow-sm'
        )}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {t('languages.dashboard.os.nextSession')}
                </p>
              </div>
              {nextSession.status === 'live' && (
                <p className="text-sm font-bold text-emerald-600 animate-pulse flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  {t('languages.dashboard.classroom.liveNow')}
                </p>
              )}
              <p className="text-lg font-bold text-foreground">
                {nextSession.scheduledAt ? new Date(nextSession.scheduledAt).toLocaleString() : t('languages.dashboard.os.noSession')}
              </p>
              <p className="text-sm text-muted-foreground">
                {nextSession.teacherName || t(`languages.dashboard.os.teacherRole.${nextSession.teacherRole}`)}
              </p>
            </div>
            {nextSession.scheduledAt && (
              <SessionCountdownGated
                scheduledAt={nextSession.scheduledAt}
                joinLink={nextSession.joinLink}
                className="shrink-0"
              />
            )}
          </div>
        </div>
      )}

      {/* ═══ Current Lesson Hero ═══ */}
      <div className="bg-card border border-primary/15 rounded-2xl p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              {t('languages.dashboard.os.currentLessonPanel')}
            </p>
            <h2 className="text-lg font-bold text-foreground leading-snug">
              {currentReleasedLesson ?? t('languages.dashboard.os.noLesson')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {currentReleasedModule ?? t('languages.dashboard.os.noModule')}
            </p>
            {currentLessonStatus === 'review_required' && (
              <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {t('languages.dashboard.runtimeLabels.review_required')}
              </p>
            )}
            {courseState?.next_teacher_decision && (
              <p className="text-xs text-muted-foreground italic">{courseState.next_teacher_decision}</p>
            )}
          </div>
          <DSButton
            size="sm"
            onClick={() => currentReleasedLesson && navigate(`/languages/russian/lessons/${currentReleasedLesson}`)}
            disabled={!currentReleasedLesson}
            className="gap-2 shrink-0 shadow-sm"
          >
            <PlayCircle className="w-4 h-4" />
            {t('languages.dashboard.os.quick.resumeLesson')}
          </DSButton>
        </div>
      </div>

      {/* ═══ Session Sync (collapsed) — only in compact mode ═══ */}
      {compact && (() => {
        const futureSessions = data.sessions.filter((s) => {
          if (s.status === 'cancelled' || s.status === 'completed') return false;
          if (!s.scheduledAt) return true;
          const endTime = new Date(s.scheduledAt).getTime() + DEFAULT_DURATION_MS;
          return Date.now() < endTime;
        });
        if (!futureSessions.length) return null;
        return (
          <details className="bg-card border border-border rounded-2xl shadow-sm group">
            <summary className="p-5 cursor-pointer text-sm font-semibold text-foreground flex items-center gap-2.5 hover:bg-muted/20 transition-colors rounded-2xl">
              <Clock3 className="w-4 h-4 text-muted-foreground" />
              {t('languages.dashboard.os.sessionSync')}
              <span className="ms-auto inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold text-muted-foreground">
                {futureSessions.length}
              </span>
            </summary>
            <div className="px-5 pb-5 space-y-2 border-t border-border">
              {futureSessions.slice(0, 6).map((session) => (
                <div key={session.id} className="rounded-xl border border-border p-3.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t(`languages.dashboard.os.teacherRole.${session.teacherRole}`)} · {t(`languages.dashboard.os.sessionStatus.${session.status}`)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {session.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : t('languages.dashboard.os.noSession')}
                    </p>
                  </div>
                  <SessionCountdownGated scheduledAt={session.scheduledAt!} joinLink={session.joinLink} />
                </div>
              ))}
            </div>
          </details>
        );
      })()}
    </div>
  );
}
