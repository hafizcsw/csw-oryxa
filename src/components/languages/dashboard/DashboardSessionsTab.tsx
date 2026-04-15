import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, XCircle, Star, ClipboardList, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { StudentOperatingSystemData, StudentSessionCard } from '@/types/studentOperatingSystem';
import { SessionCountdownGated } from '@/components/ui/SessionCountdownGated';
import { cn } from '@/lib/utils';
import { dismissStudentSession } from '@/hooks/useSessionActionItems';
import { toast } from '@/hooks/use-toast';

interface Props {
  operatingSystemData?: StudentOperatingSystemData | null;
}

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

function isSessionExpired(session: StudentSessionCard) {
  if (!session.scheduledAt) return false;
  return Date.now() > new Date(session.scheduledAt).getTime() + DEFAULT_DURATION_MS;
}

export function DashboardSessionsTab({ operatingSystemData }: Props) {
  const { t } = useLanguage();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const allSessions = useMemo(() => {
    const raw = operatingSystemData?.sessions || [];
    return Array.from(new Map(raw.map(s => [s.id, s])).values());
  }, [operatingSystemData?.sessions]);

  const upcoming = useMemo(() =>
    allSessions.filter(s => (s.status === 'upcoming' || s.status === 'live') && !isSessionExpired(s) && !dismissedIds.has(s.id)),
    [allSessions, dismissedIds]);

  const past = useMemo(() =>
    allSessions.filter(s => (s.status === 'completed' || s.status === 'cancelled' || isSessionExpired(s)) && !dismissedIds.has(s.id)).slice(0, 10),
    [allSessions, dismissedIds]);

  const handleDismiss = async (sessionId: string) => {
    const res = await dismissStudentSession(sessionId);
    if (res.ok) {
      setDismissedIds(prev => new Set(prev).add(sessionId));
      toast({ title: t('languages.dashboard.sessions.dismissed', { defaultValue: 'Session removed' }) });
    } else {
      toast({ title: t('languages.dashboard.actions.error', { defaultValue: 'Failed' }), variant: 'destructive' });
    }
  };

  if (!operatingSystemData) return null;

  return (
    <div className="space-y-4">
      {/* Upcoming / Live sessions */}
      <section className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {t('languages.dashboard.sessions.upcoming')}
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            {t('languages.dashboard.sessions.noUpcoming')}
          </p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(session => (
              <div key={session.id} className="border border-border rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t(`languages.dashboard.os.teacherRole.${session.teacherRole}`)}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                    {session.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : '-'}
                  </p>
                  {session.teacherName && (
                    <p className="text-xs text-muted-foreground">{session.teacherName}</p>
                  )}
                </div>
                {session.scheduledAt && (
                  <SessionCountdownGated
                    scheduledAt={session.scheduledAt}
                    joinLink={session.joinLink}
                    durationMs={DEFAULT_DURATION_MS}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past sessions with status, teacher feedback, and homework */}
      {past.length > 0 && (
        <section className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {t('languages.dashboard.sessions.recentCompleted')}
          </h3>
          <div className="space-y-2">
            {past.map(session => {
              const isCancelled = session.status === 'cancelled';
              const isCompleted = session.status === 'completed';
              return (
                <div key={session.id} className={cn(
                  "border rounded-lg p-3 space-y-2",
                  isCancelled ? "border-destructive/30 bg-destructive/5" : "border-border"
                )}>
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      {isCancelled ? (
                        <XCircle className="w-4 h-4 text-destructive shrink-0" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Clock3 className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      {t(`languages.dashboard.os.teacherRole.${session.teacherRole}`)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                        isCancelled
                          ? "bg-destructive/10 text-destructive"
                          : isCompleted
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {isCancelled
                          ? t('languages.dashboard.sessions.cancelled', { defaultValue: 'Cancelled' })
                          : isCompleted
                          ? t('languages.dashboard.sessions.completed', { defaultValue: 'Completed' })
                          : t('languages.dashboard.sessions.sessionEnded', { defaultValue: 'Session ended' })
                        }
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {session.scheduledAt ? new Date(session.scheduledAt).toLocaleDateString() : '-'}
                      </span>
                      <button
                        onClick={() => handleDismiss(session.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title={t('languages.dashboard.sessions.dismiss', { defaultValue: 'Remove' })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Teacher feedback / summary */}
                  {session.summary && (
                    <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {t('languages.dashboard.sessions.teacherFeedback')}
                      </p>
                      <p className="text-xs text-foreground">{session.summary}</p>
                    </div>
                  )}

                  {/* Next action / homework from teacher */}
                  {session.nextAction && (
                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-2.5 space-y-1">
                      <p className="text-[10px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
                        <ClipboardList className="w-3 h-3" />
                        {t('languages.dashboard.sessions.homework')}
                      </p>
                      <p className="text-xs text-foreground">
                        {t(`languages.dashboard.sessions.nextActions.${session.nextAction}`, { defaultValue: session.nextAction })}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
