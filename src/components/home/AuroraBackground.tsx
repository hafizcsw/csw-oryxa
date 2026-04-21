import { useEffect, useRef } from 'react';

interface AuroraBackgroundProps {
  className?: string;
}

export function AuroraBackground({ className = '' }: AuroraBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Respect reduced motion + skip on touch / small screens
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSmall = window.matchMedia('(max-width: 767px)').matches;
    if (prefersReduced || isSmall) return;

    let targetX = root.clientWidth / 2;
    let targetY = root.clientHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let rafId = 0;

    const onMove = (e: MouseEvent) => {
      const rect = root.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      root.style.setProperty('--mx', `${currentX}px`);
      root.style.setProperty('--my', `${currentY}px`);
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={rootRef} className={`aurora-root ${className}`} aria-hidden="true">
      <div className="aurora-mesh" />
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
      <div className="aurora-spotlight" />
      <div className="aurora-grain" />
    </div>
  );
}
