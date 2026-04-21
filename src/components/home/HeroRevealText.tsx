interface HeroRevealTextProps {
  text: string;
  className?: string;
  showCursor?: boolean;
  shimmer?: boolean;
  staggerMs?: number;
  startDelayMs?: number;
}

export function HeroRevealText({
  text,
  className = '',
  showCursor = true,
  shimmer = true,
  staggerMs = 90,
  startDelayMs = 100,
}: HeroRevealTextProps) {
  const words = text.split(/(\s+)/);

  return (
    <span className={`inline-block ${shimmer ? 'hero-reveal-shimmer' : ''} ${className}`}>
      {words.map((w, i) => {
        if (/^\s+$/.test(w)) return <span key={i}>{w}</span>;
        return (
          <span
            key={i}
            className="hero-reveal-word"
            style={{ animationDelay: `${startDelayMs + i * staggerMs}ms` }}
          >
            {w}
          </span>
        );
      })}
      {showCursor && <span className="hero-reveal-cursor" />}
    </span>
  );
}
