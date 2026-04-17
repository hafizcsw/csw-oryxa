// ═══════════════════════════════════════════════════════════════
// AIDataFlowHero — Multi-document Analysis Hero (visual only)
// ═══════════════════════════════════════════════════════════════
// Scene structure:
//   - backgroundDocumentLayers  (faint stacked cards behind clusters)
//   - leftDocumentCluster       (3 fanned cards, left)
//   - rightDocumentCluster      (3 fanned cards, right)
//   - connectorPaths            (curved lines from each card → core)
//   - flowParticles             (animateMotion bubbles, inward-dominant)
//   - glow                      (breathing radial behind core)
//   - centerCore                (analysis brain/core, cool purple/blue)
//
// HARD CONTRACTS:
//   - SVG + React + framer-motion only (no canvas, video, lottie).
//   - No hardcoded visible text. 12-language safe.
//   - prefers-reduced-motion respected.
//   - Not connected to the reading engine. Purely visual.
// ═══════════════════════════════════════════════════════════════

import { memo, useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AIDataFlowHeroProps {
  className?: string;
  /** 'calm' | 'normal' | 'lively' — controls particle density + speed. */
  intensity?: "calm" | "normal" | "lively";
  /** Localized aria-label (pass from i18n). */
  ariaLabel?: string;
  /** Visible cards per side (1–4). Background layers imply more. Default 3. */
  visibleCardsPerSide?: number;
}

const VIEWBOX_W = 900;
const VIEWBOX_H = 420;
const CX = VIEWBOX_W / 2;
const CY = VIEWBOX_H / 2;

const INTENSITY_MAP = {
  calm:   { particleDuration: 5.0, inwardCount: 1, returnEvery: 2, glowDuration: 5.4 },
  normal: { particleDuration: 3.6, inwardCount: 2, returnEvery: 2, glowDuration: 4.2 },
  lively: { particleDuration: 2.6, inwardCount: 3, returnEvery: 1, glowDuration: 3.2 },
} as const;

// Card geometry (used for both clusters)
const CARD_W = 96;
const CARD_H = 120;

// Fan offsets — creates a layered/clustered look (front card last for stacking)
// Each entry: { dx, dy, rotate, scale, opacity }
const FAN = [
  { dx: -22, dy: -10, rotate: -10, scale: 0.92, opacity: 0.85 },
  { dx:   0, dy:  10, rotate:   2, scale: 0.97, opacity: 0.95 },
  { dx:  22, dy: -6,  rotate:   8, scale: 1.0,  opacity: 1.0  },
  { dx:  44, dy:  14, rotate:  14, scale: 0.94, opacity: 0.9  },
];

// Background "implied more docs" silhouettes
const BG_LAYERS_LEFT = [
  { x: 60,  y: 90,  rotate: -16, opacity: 0.18, scale: 0.85 },
  { x: 40,  y: 200, rotate: -22, opacity: 0.12, scale: 0.78 },
  { x: 110, y: 260, rotate: -6,  opacity: 0.16, scale: 0.82 },
];
const BG_LAYERS_RIGHT = [
  { x: 740, y: 90,  rotate: 16, opacity: 0.18, scale: 0.85 },
  { x: 770, y: 210, rotate: 22, opacity: 0.12, scale: 0.78 },
  { x: 690, y: 270, rotate: 6,  opacity: 0.16, scale: 0.82 },
];

function AIDataFlowHeroComponent({
  className,
  intensity = "normal",
  ariaLabel,
  visibleCardsPerSide = 3,
}: AIDataFlowHeroProps) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const cfg = INTENSITY_MAP[intensity];

  const ids = useMemo(
    () => ({
      coreGrad:    `aidf-core-${uid}`,
      glow:        `aidf-glow-${uid}`,
      paperShadow: `aidf-paper-${uid}`,
      lineGrad:    `aidf-line-${uid}`,
      pulseGrad:   `aidf-pulse-${uid}`,
      ringGrad:    `aidf-ring-${uid}`,
    }),
    [uid],
  );

  const cardsPerSide = Math.max(1, Math.min(4, visibleCardsPerSide));

  // Cluster anchor points (where the fan is centered)
  const LEFT_ANCHOR  = { x: 150, y: 165 };
  const RIGHT_ANCHOR = { x: 660, y: 165 };

  // Build cards & their connector source points
  const leftCards = FAN.slice(0, cardsPerSide).map((f, i) => ({
    ...f,
    x: LEFT_ANCHOR.x + f.dx,
    y: LEFT_ANCHOR.y + f.dy,
    side: "left" as const,
    index: i,
  }));
  const rightCards = FAN.slice(0, cardsPerSide).map((f, i) => ({
    ...f,
    x: RIGHT_ANCHOR.x + f.dx,
    y: RIGHT_ANCHOR.y + f.dy,
    side: "right" as const,
    index: i,
  }));

  // Connector paths: from each card's inner edge → core
  const connectors = useMemo(() => {
    const paths: Array<{ d: string; key: string }> = [];
    leftCards.forEach((c, i) => {
      const sx = c.x + CARD_W;            // right edge of left card
      const sy = c.y + CARD_H / 2;
      const c1x = sx + 90;
      const c1y = sy + (i - cardsPerSide / 2) * 8;
      const c2x = CX - 110;
      const c2y = CY + (i - cardsPerSide / 2) * 6;
      paths.push({
        d: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${CX - 60} ${CY}`,
        key: `L-${i}`,
      });
    });
    rightCards.forEach((c, i) => {
      const sx = c.x;                     // left edge of right card
      const sy = c.y + CARD_H / 2;
      const c1x = sx - 90;
      const c1y = sy + (i - cardsPerSide / 2) * 8;
      const c2x = CX + 110;
      const c2y = CY + (i - cardsPerSide / 2) * 6;
      paths.push({
        d: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${CX + 60} ${CY}`,
        key: `R-${i}`,
      });
    });
    return paths;
  }, [cardsPerSide, leftCards, rightCards]);

  return (
    <div className={cn("relative w-full select-none", className)}>
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="block w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={ariaLabel}
        aria-hidden={ariaLabel ? undefined : true}
      >
        <defs>
          {/* Core radial — cool indigo/violet feel via primary token */}
          <radialGradient id={ids.coreGrad} cx="50%" cy="50%" r="60%">
            <stop offset="0%"   stopColor="hsl(var(--primary))"   stopOpacity="1" />
            <stop offset="55%"  stopColor="hsl(var(--primary))"   stopOpacity="0.65" />
            <stop offset="100%" stopColor="hsl(var(--primary))"   stopOpacity="0.15" />
          </radialGradient>

          {/* Soft breathing glow */}
          <radialGradient id={ids.glow} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.45" />
            <stop offset="55%"  stopColor="hsl(var(--primary))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>

          {/* Connector gradient */}
          <linearGradient id={ids.lineGrad} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.05" />
            <stop offset="50%"  stopColor="hsl(var(--primary))" stopOpacity="0.55" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
          </linearGradient>

          {/* Paper shadow */}
          <filter id={ids.paperShadow} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" />
            <feOffset dx="0" dy="3" result="o" />
            <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Particle */}
          <radialGradient id={ids.pulseGrad} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop offset="55%"  stopColor="hsl(var(--primary))" stopOpacity="0.7" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>

          {/* Core orbit ring */}
          <linearGradient id={ids.ringGrad} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.0" />
            <stop offset="50%"  stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* ═══ Background document layers (implied more) ═══ */}
        <g>
          {[...BG_LAYERS_LEFT, ...BG_LAYERS_RIGHT].map((b, i) => (
            <g
              key={`bg-${i}`}
              transform={`translate(${b.x}, ${b.y}) rotate(${b.rotate}) scale(${b.scale})`}
              opacity={b.opacity}
            >
              <rect
                width={CARD_W}
                height={CARD_H}
                rx={8}
                fill="hsl(var(--card))"
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
            </g>
          ))}
        </g>

        {/* ═══ Glow ═══ */}
        <g>
          {reduceMotion ? (
            <circle cx={CX} cy={CY} r="150" fill={`url(#${ids.glow})`} />
          ) : (
            <motion.circle
              cx={CX}
              cy={CY}
              r="150"
              fill={`url(#${ids.glow})`}
              animate={{ scale: [1, 1.1, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: cfg.glowDuration, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
            />
          )}
        </g>

        {/* ═══ Connector paths ═══ */}
        <g fill="none" strokeLinecap="round">
          {connectors.map((p, i) => (
            <ConnectorPath
              key={p.key}
              d={p.d}
              gradientId={ids.lineGrad}
              animate={!reduceMotion}
              delay={i * 0.12}
            />
          ))}
        </g>

        {/* ═══ Document clusters (left + right) ═══ */}
        <g>
          {leftCards.map((c, i) => (
            <DocumentCard
              key={`L-${i}`}
              x={c.x}
              y={c.y}
              rotate={c.rotate}
              scale={c.scale}
              opacity={c.opacity}
              shadowId={ids.paperShadow}
              accentVariant={i % 3}
              float={!reduceMotion}
              floatDelay={i * 0.4}
              mirrored={false}
            />
          ))}
          {rightCards.map((c, i) => (
            <DocumentCard
              key={`R-${i}`}
              x={c.x}
              y={c.y}
              rotate={-c.rotate}
              scale={c.scale}
              opacity={c.opacity}
              shadowId={ids.paperShadow}
              accentVariant={(i + 1) % 3}
              float={!reduceMotion}
              floatDelay={i * 0.4 + 0.6}
              mirrored
            />
          ))}
        </g>

        {/* ═══ Flow particles (inward dominant + occasional return) ═══ */}
        {!reduceMotion && (
          <g>
            {connectors.map((p, i) =>
              Array.from({ length: cfg.inwardCount }).map((_, k) => (
                <PulseParticle
                  key={`in-${p.key}-${k}`}
                  pathD={p.d}
                  duration={cfg.particleDuration}
                  delay={(i * 0.28) + (k * (cfg.particleDuration / cfg.inwardCount))}
                  gradientId={ids.pulseGrad}
                  reverse={false}
                />
              )),
            )}
            {connectors
              .filter((_, i) => i % cfg.returnEvery === 0)
              .map((p, i) => (
                <PulseParticle
                  key={`out-${p.key}`}
                  pathD={p.d}
                  duration={cfg.particleDuration * 1.8}
                  delay={i * 0.6 + 1.4}
                  gradientId={ids.pulseGrad}
                  reverse
                  small
                />
              ))}
          </g>
        )}

        {/* ═══ Center core ═══ */}
        <g transform={`translate(${CX}, ${CY})`}>
          <CoreShape
            gradientId={ids.coreGrad}
            ringGradId={ids.ringGrad}
            animate={!reduceMotion}
          />
        </g>
      </svg>
    </div>
  );
}

export const AIDataFlowHero = memo(AIDataFlowHeroComponent);

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

interface DocumentCardProps {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
  shadowId: string;
  accentVariant: number;
  float: boolean;
  floatDelay: number;
  mirrored?: boolean;
}

function DocumentCard({
  x, y, rotate, scale, opacity, shadowId, accentVariant, float, floatDelay, mirrored,
}: DocumentCardProps) {
  const W = CARD_W;
  const H = CARD_H;

  // Decorative line widths to imply variety per card
  const lineSets = [
    [W - 28, W - 36, W - 24, W - 44],
    [W - 22, W - 40, W - 28, W - 36],
    [W - 30, W - 24, W - 38, W - 28],
  ];
  const lines = lineSets[accentVariant % lineSets.length];

  const sheet = (
    <g filter={`url(#${shadowId})`}>
      <rect
        width={W}
        height={H}
        rx={8}
        fill="hsl(var(--card))"
        stroke="hsl(var(--border))"
        strokeWidth={1}
      />
      {/* Folded corner */}
      <path
        d={mirrored
          ? `M 0 0 L 16 0 L 0 16 Z`
          : `M ${W} 0 L ${W - 16} 0 L ${W} 16 Z`}
        fill="hsl(var(--muted))"
      />
      {/* Header band */}
      <rect x="12" y="14" width={W - 40} height="6" rx="2" fill="hsl(var(--primary) / 0.18)" />
      {/* Decorative lines (no text) */}
      <g stroke="hsl(var(--muted-foreground))" strokeOpacity="0.32" strokeWidth="1.2" strokeLinecap="round">
        <line x1="12" y1="36" x2={lines[0]} y2="36" />
        <line x1="12" y1="48" x2={lines[1]} y2="48" />
        <line x1="12" y1="60" x2={lines[2]} y2="60" />
        <line x1="12" y1="72" x2={lines[3]} y2="72" />
      </g>
      {/* Footer chip */}
      <rect x="12" y={H - 26} width="36" height="14" rx="3" fill="hsl(var(--primary) / 0.14)" />
      {/* Status dot */}
      <circle cx={W - 18} cy={H - 19} r="6" fill="hsl(var(--primary))" />
      <path
        d={`M ${W - 21} ${H - 19} L ${W - 19} ${H - 17} L ${W - 15} ${H - 21}`}
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );

  const transform = `translate(${x}, ${y}) rotate(${rotate} ${W / 2} ${H / 2}) scale(${scale})`;

  if (!float) {
    return <g transform={transform} opacity={opacity}>{sheet}</g>;
  }

  return (
    <motion.g
      transform={transform}
      opacity={opacity}
      animate={{ y: [0, -2.5, 0, 2.5, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: floatDelay }}
    >
      {sheet}
    </motion.g>
  );
}

interface ConnectorPathProps {
  d: string;
  gradientId: string;
  animate: boolean;
  delay: number;
}

function ConnectorPath({ d, gradientId, animate, delay }: ConnectorPathProps) {
  if (!animate) {
    return (
      <path
        d={d}
        stroke={`url(#${gradientId})`}
        strokeWidth={1.3}
        strokeDasharray="3 4"
        opacity={0.6}
      />
    );
  }
  return (
    <motion.path
      d={d}
      stroke={`url(#${gradientId})`}
      strokeWidth={1.3}
      strokeDasharray="3 4"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.75 }}
      transition={{
        pathLength: { duration: 1.6, delay, ease: "easeInOut" },
        opacity:    { duration: 0.6, delay },
      }}
    />
  );
}

interface PulseParticleProps {
  pathD: string;
  duration: number;
  delay: number;
  gradientId: string;
  reverse: boolean;
  small?: boolean;
}

function PulseParticle({ pathD, duration, delay, gradientId, reverse, small }: PulseParticleProps) {
  const r = small ? 1.8 : 2.8;
  return (
    <g>
      <circle r={r} fill={`url(#${gradientId})`}>
        <animateMotion
          dur={`${duration}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
          path={pathD}
          rotate="auto"
          keyPoints={reverse ? "1;0" : "0;1"}
          keyTimes="0;1"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.15;0.85;1"
          dur={`${duration}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
}

interface CoreShapeProps {
  gradientId: string;
  ringGradId: string;
  animate: boolean;
}

function CoreShape({ gradientId, ringGradId, animate }: CoreShapeProps) {
  // Hex/diamond analysis core with internal neural lines
  const core = (
    <>
      {/* Outer faint ring */}
      <circle r="78" fill="none" stroke="hsl(var(--primary))" strokeOpacity="0.18" strokeWidth="1" />
      {/* Mid ring (rotates) */}
      {animate ? (
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        >
          <circle r="62" fill="none" stroke={`url(#${ringGradId})`} strokeWidth="1.2" strokeDasharray="2 6" />
        </motion.g>
      ) : (
        <circle r="62" fill="none" stroke={`url(#${ringGradId})`} strokeWidth="1.2" strokeDasharray="2 6" />
      )}

      {/* Core hex */}
      <path
        d="M 0 -50 L 43 -25 L 43 25 L 0 50 L -43 25 L -43 -25 Z"
        fill={`url(#${gradientId})`}
        stroke="hsl(var(--primary))"
        strokeOpacity="0.55"
        strokeWidth="1.4"
      />

      {/* Inner neural pattern — hub & spokes */}
      <g stroke="hsl(var(--primary-foreground))" strokeOpacity="0.55" strokeWidth="1" fill="none" strokeLinecap="round">
        <line x1="0"   y1="0" x2="0"    y2="-32" />
        <line x1="0"   y1="0" x2="28"   y2="-16" />
        <line x1="0"   y1="0" x2="28"   y2="16"  />
        <line x1="0"   y1="0" x2="0"    y2="32"  />
        <line x1="0"   y1="0" x2="-28"  y2="16"  />
        <line x1="0"   y1="0" x2="-28"  y2="-16" />
      </g>
      {/* Spoke endpoints */}
      <g fill="hsl(var(--primary-foreground))">
        <circle cx="0"   cy="-32" r="2.4" />
        <circle cx="28"  cy="-16" r="2.4" />
        <circle cx="28"  cy="16"  r="2.4" />
        <circle cx="0"   cy="32"  r="2.4" />
        <circle cx="-28" cy="16"  r="2.4" />
        <circle cx="-28" cy="-16" r="2.4" />
      </g>
      {/* Center node */}
      <circle r="6" fill="hsl(var(--primary-foreground))" />
      <circle r="3" fill="hsl(var(--primary))" />
    </>
  );

  if (!animate) return <g>{core}</g>;

  return (
    <motion.g
      animate={{ scale: [1, 1.03, 1] }}
      transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
    >
      {core}
    </motion.g>
  );
}
