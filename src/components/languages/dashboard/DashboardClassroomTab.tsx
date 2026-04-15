import { useMemo } from 'react';
import { CalendarClock, NotebookPen, ArrowRightCircle } from 'lucide-react';
import { DSButton } from '@/components/design-system/DSButton';
import { useLanguage } from '@/contexts/LanguageContext';
import type { StudentOperatingSystemData } from '@/types/studentOperatingSystem';
import { StudentOperatingSystemTabContext } from '@/components/languages/dashboard/StudentOperatingSystemTabContext';
import { SessionCountdownGated } from '@/components/ui/SessionCountdownGated';

interface Props {
  operatingSystemData?: StudentOperatingSystemData | null;
}

export function DashboardClassroomTab({ operatingSystemData }: Props) {
  const { t } = useLanguage();

  const activeSession = useMemo(
    () => (operatingSystemData?.sessions || []).find((session) => session.status === 'live' || session.status === 'upcoming') ?? null,
    [operatingSystemData],
  );

  if (!operatingSystemData) return null;

  return (
    <div className="space-y-4">
      <StudentOperatingSystemTabContext data={operatingSystemData} surface="classroom" />

      <section className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('languages.dashboard.classroom.entryTitle')}</h3>

        {!activeSession ? (
          <p className="text-sm text-muted-foreground">{t('languages.dashboard.classroom.noUpcoming')}</p>
        ) : (
          <>
            <div className="rounded-lg border border-border p-3 space-y-1.5">
              <p className="text-sm font-medium text-foreground">{t(`languages.dashboard.os.teacherRole.${activeSession.teacherRole}`)}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />{activeSession.scheduledAt ? new Date(activeSession.scheduledAt).toLocaleString() : t('languages.dashboard.os.noSession')}</p>
              <p className="text-xs text-muted-foreground">{t('languages.dashboard.classroom.targetLesson', { lesson: activeSession.targetLessonSlug || '-', module: activeSession.targetModuleSlug || '-' })}</p>
              {activeSession.summary && <p className="text-xs text-muted-foreground">{t('languages.dashboard.classroom.recapPrefix')}: {activeSession.summary}</p>}
              {activeSession.nextAction && <p className="text-xs text-foreground">{t('languages.dashboard.classroom.nextStepPrefix')}: {activeSession.nextAction}</p>}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {activeSession.scheduledAt ? (
                <SessionCountdownGated
                  scheduledAt={activeSession.scheduledAt}
                  joinLink={activeSession.joinLink}
                />
              ) : (
                <DSButton size="sm" disabled className="gap-1.5">
                  {t('languages.dashboard.classroom.joinNow')}
                </DSButton>
              )}
              <DSButton size="sm" variant="outline" className="gap-1.5" disabled={!activeSession.summary}>
                <NotebookPen className="w-3.5 h-3.5" />
                {t('languages.dashboard.classroom.openRecap')}
              </DSButton>
              <DSButton size="sm" variant="outline" className="gap-1.5" disabled={!activeSession.nextAction}>
                <ArrowRightCircle className="w-3.5 h-3.5" />
                {t('languages.dashboard.classroom.afterClassStep')}
              </DSButton>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
