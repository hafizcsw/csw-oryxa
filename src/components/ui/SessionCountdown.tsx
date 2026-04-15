/**
 * SessionCountdown — Live countdown timer for upcoming sessions.
 * Shows days/hours/minutes/seconds until session start.
 * Respects session duration so "Live" only shows during the actual session window.
 * Times are always displayed in the user's local timezone automatically.
 */
import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Clock, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  scheduledAt: string;
  joinLink?: string | null;
  compact?: boolean;
  className?: string;
  /** Session duration in minutes — defaults to 60 */
  durationMinutes?: number;
  /** Session status from DB — if 'completed' or 'cancelled', skip live state */
  sessionStatus?: string;
  /** Show the local time label next to countdown */
  showLocalTime?: boolean;
}

function getTimeLeft(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    total: diff,
  };
}

function formatLocalTime(isoDate: string, locale: string) {
  try {
    return new Date(isoDate).toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return new Date(isoDate).toLocaleTimeString();
  }
}

export function SessionCountdown({
  scheduledAt, joinLink, compact, className,
  durationMinutes = 60,
  sessionStatus,
  showLocalTime,
}: Props) {
  const { t, language } = useLanguage();
  const [tl, setTl] = useState(() => getTimeLeft(scheduledAt));

  useEffect(() => {
    const iv = setInterval(() => setTl(getTimeLeft(scheduledAt)), 1000);
    return () => clearInterval(iv);
  }, [scheduledAt]);

  // Calculate if session is actually live (within the session window)
  const sessionState = useMemo(() => {
    if (sessionStatus === 'completed' || sessionStatus === 'cancelled') return 'ended';
    const startTime = new Date(scheduledAt).getTime();
    const endTime = startTime + durationMinutes * 60000;
    const now = Date.now();
    if (now < startTime) return 'upcoming';
    if (now >= startTime && now <= endTime) return 'live';
    return 'ended';
  }, [scheduledAt, durationMinutes, sessionStatus, tl.total]);

  const localTimeLabel = useMemo(() =>
    formatLocalTime(scheduledAt, language === 'ar' ? 'ar-SA' : 'en-US'),
    [scheduledAt, language]
  );

  // Session ended
  if (sessionState === 'ended') {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {t('common.session_ended', { defaultValue: 'Ended' })}
        </span>
      </div>
    );
  }

  // Session is live now
  if (sessionState === 'live') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
        </span>
        <span className="text-sm font-semibold text-destructive">
          {t('common.session_live', { defaultValue: 'Live Now!' })}
        </span>
        {joinLink && (
          <a href={joinLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Video className="h-3.5 w-3.5" />
            {t('common.join', { defaultValue: 'Join' })}
          </a>
        )}
      </div>
    );
  }

  // Upcoming — show countdown
  const units = [
    { value: tl.days, label: t('common.countdown.days', { defaultValue: 'D' }) },
    { value: tl.hours, label: t('common.countdown.hours', { defaultValue: 'H' }) },
    { value: tl.minutes, label: t('common.countdown.minutes', { defaultValue: 'M' }) },
    { value: tl.seconds, label: t('common.countdown.seconds', { defaultValue: 'S' }) },
  ];

  const displayUnits = compact ? units.filter((u, i) => i > 0 || u.value > 0) : units;
  const isUrgent = tl.total < 3600000;
  const isSoon = tl.total < 86400000;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <Clock className={cn('h-3.5 w-3.5', isUrgent ? 'text-destructive' : isSoon ? 'text-amber-500' : 'text-muted-foreground')} />
        <span className={cn('text-xs font-mono tabular-nums', isUrgent ? 'text-destructive font-semibold' : isSoon ? 'text-amber-600' : 'text-muted-foreground')}>
          {displayUnits.map(u => `${String(u.value).padStart(2, '0')}${u.label}`).join(' ')}
        </span>
        {showLocalTime && (
          <span className="text-[10px] text-muted-foreground ms-1">({localTimeLabel})</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Clock className={cn('h-4 w-4', isUrgent ? 'text-destructive' : isSoon ? 'text-amber-500' : 'text-primary')} />
      <div className="flex items-center gap-1.5">
        {displayUnits.map((u, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className={cn(
              'text-sm font-bold tabular-nums leading-none px-1.5 py-1 rounded-md min-w-[32px] text-center',
              isUrgent ? 'bg-destructive/10 text-destructive' : isSoon ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'
            )}>
              {String(u.value).padStart(2, '0')}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{u.label}</span>
          </div>
        ))}
      </div>
      {showLocalTime && (
        <span className="text-xs text-muted-foreground">({localTimeLabel})</span>
      )}
      {joinLink && isSoon && (
        <a href={joinLink} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline ms-2">
          <Video className="h-3.5 w-3.5" />
          {t('common.join', { defaultValue: 'Join' })}
        </a>
      )}
    </div>
  );
}