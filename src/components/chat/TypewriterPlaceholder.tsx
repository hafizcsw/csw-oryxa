import { useEffect, useState } from 'react';

type Props = {
  phrases: string[];
  typingSpeedMs?: number;
  erasingSpeedMs?: number;
  pauseMs?: number;
  className?: string;
};

/**
 * Rotating typewriter placeholder text.
 * - Respects prefers-reduced-motion (shows first phrase statically)
 * - RTL/LTR agnostic (renders raw text; container controls direction)
 */
export function TypewriterPlaceholder({
  phrases,
  typingSpeedMs = 55,
  erasingSpeedMs = 28,
  pauseMs = 1800,
  className,
}: Props) {
  const safePhrases = phrases.filter(Boolean);
  const [text, setText] = useState('');
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'erasing'>('typing');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    if (reducedMotion || safePhrases.length === 0) return;

    const current = safePhrases[index % safePhrases.length];
    let timeout: number;

    if (phase === 'typing') {
      if (text.length < current.length) {
        timeout = window.setTimeout(
          () => setText(current.slice(0, text.length + 1)),
          typingSpeedMs
        );
      } else {
        timeout = window.setTimeout(() => setPhase('pausing'), pauseMs);
      }
    } else if (phase === 'pausing') {
      timeout = window.setTimeout(() => setPhase('erasing'), 200);
    } else {
      if (text.length > 0) {
        timeout = window.setTimeout(
          () => setText(current.slice(0, text.length - 1)),
          erasingSpeedMs
        );
      } else {
        setIndex((i) => (i + 1) % safePhrases.length);
        setPhase('typing');
      }
    }

    return () => window.clearTimeout(timeout);
  }, [text, phase, index, safePhrases, typingSpeedMs, erasingSpeedMs, pauseMs, reducedMotion]);

  if (safePhrases.length === 0) return null;
  const display = reducedMotion ? safePhrases[0] : text;

  return (
    <span className={className} aria-hidden="true">
      {display}
      {!reducedMotion && (
        <span className="inline-block w-[1px] h-[1em] align-middle ml-0.5 bg-current animate-pulse" />
      )}
    </span>
  );
}
