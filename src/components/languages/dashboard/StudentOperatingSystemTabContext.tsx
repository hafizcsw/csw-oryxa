import { useMemo } from 'react';
import { AlertTriangle, CalendarClock, ListChecks, UserCircle2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { StudentOperatingSystemData } from '@/types/studentOperatingSystem';

interface Props {
  data: StudentOperatingSystemData | null;
  surface: 'overview' | 'assignments' | 'progress' | 'words' | 'exams' | 'sessions' | 'messages' | 'classroom';
}

export function StudentOperatingSystemTabContext({ data, surface }: Props) {
  const { t } = useLanguage();

  const nextByRole = useMemo(() => {
    if (!data) return { language: null as string | null, exam: null as string | null };
    const languageSession = data.sessions.find((session) => (session.status === 'upcoming' || session.status === 'live') && session.teacherRole === 'language_teacher');
    const examSession = data.sessions.find((session) => (session.status === 'upcoming' || session.status === 'live') && session.teacherRole === 'curriculum_exam_teacher');
    return {
      language: languageSession?.scheduledAt ?? null,
      exam: examSession?.scheduledAt ?? null,
    };
  }, [data]);

  if (!data) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 md:p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{t(`languages.dashboard.os.surface.${surface}`)}</p>
        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">{t(`languages.dashboard.os.planHealth.${data.planHealth.state}`)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground mb-1"><ListChecks className="w-3.5 h-3.5" />{t('languages.dashboard.os.pendingQueue')}</div>
          <p className="font-semibold text-foreground">{data.queue.length}</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground mb-1"><CalendarClock className="w-3.5 h-3.5" />{t('languages.dashboard.os.nextLanguageSession')}</div>
          <p className="font-semibold text-foreground">{nextByRole.language ? new Date(nextByRole.language).toLocaleDateString() : t('languages.dashboard.os.noSession')}</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground mb-1"><CalendarClock className="w-3.5 h-3.5" />{t('languages.dashboard.os.nextExamSession')}</div>
          <p className="font-semibold text-foreground">{nextByRole.exam ? new Date(nextByRole.exam).toLocaleDateString() : t('languages.dashboard.os.noSession')}</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground mb-1"><AlertTriangle className="w-3.5 h-3.5" />{t('languages.dashboard.os.recoveryStatus')}</div>
          <p className="font-semibold text-foreground">{data.planHealth.recoveryPathActive ? t('languages.dashboard.os.activeRecovery') : t('languages.dashboard.os.notRequired')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground mb-1"><UserCircle2 className="w-3.5 h-3.5" />{t('languages.dashboard.os.followupOwnerLanguage')}</div>
          <p className="text-foreground">{t('languages.dashboard.os.teacherRole.language_teacher')}</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1 text-muted-foreground mb-1"><UserCircle2 className="w-3.5 h-3.5" />{t('languages.dashboard.os.followupOwnerExam')}</div>
          <p className="text-foreground">{t('languages.dashboard.os.teacherRole.curriculum_exam_teacher')}</p>
        </div>
      </div>
    </div>
  );
}
