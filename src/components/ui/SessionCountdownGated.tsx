/**
 * SessionCountdownGated — Countdown ON the button itself.
 * - Before session: button shows countdown text "Opens in HH:MM:SS"
 * - When countdown ends: button auto-activates for joining
 * - After session duration ends: button disabled "Session ended"
 */
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DoorOpen, Lock, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DSButton } from '@/components/design-system/DSButton';

interface Props {
  scheduledAt: string;
  joinLink?: string | null;
  durationMs?: number;
  className?: string;
}

const DEFAULT_DURATION = 60 * 60 * 1000;

type SessionPhase = 'waiting' | 'live' | 'ended';

function getPhase(scheduledAt: string, durationMs: number): SessionPhase {
  const now = Date.now();
  const start = new Date(scheduledAt).getTime();
  const end = start + durationMs;
  if (now < start) return 'waiting';
  if (now <= end) return 'live';
  return 'ended';
}

function getTimeLeft(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 };
  return {
    hours: Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    total: diff,
  };
}

export function SessionCountdownGated({ scheduledAt, joinLink, durationMs = DEFAULT_DURATION, className }: Props) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<SessionPhase>(() => getPhase(scheduledAt, durationMs));
  const [tl, setTl] = useState(() => getTimeLeft(scheduledAt));

  useEffect(() => {
    const iv = setInterval(() => {
      setPhase(getPhase(scheduledAt, durationMs));
      setTl(getTimeLeft(scheduledAt));
    }, 1000);
    return () => clearInterval(iv);
  }, [scheduledAt, durationMs]);

  // === ENDED ===
  if (phase === 'ended') {
    return (
      <DSButton size="sm" variant="outline" disabled className={cn("gap-1.5 shrink-0 opacity-50", className)}>
        <Lock className="w-3.5 h-3.5" />
        {t('languages.dashboard.sessions.sessionEnded', { defaultValue: 'Session ended' })}
      </DSButton>
    );
  }

  // === LIVE — join button active ===
  if (phase === 'live') {
    return (
      <DSButton
        size="sm"
        onClick={() => joinLink && window.open(joinLink, '_blank')}
        disabled={!joinLink}
        className={cn("gap-1.5 shrink-0 animate-pulse", className)}
      >
        <DoorOpen className="w-3.5 h-3.5" />
        {t('languages.dashboard.sessions.joinSession')}
      </DSButton>
    );
  }

  // === WAITING — countdown ON the button ===
  const countdownText = `${String(tl.hours).padStart(2, '0')}:${String(tl.minutes).padStart(2, '0')}:${String(tl.seconds).padStart(2, '0')}`;

  return (
    <DSButton size="sm" variant="outline" disabled className={cn("gap-1.5 shrink-0 font-mono tabular-nums", className)}>
      <Clock className="w-3.5 h-3.5" />
      {countdownText}
    </DSButton>
  );
}
