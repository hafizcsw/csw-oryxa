// ═══════════════════════════════════════════════════════════════
// AIDataFlowHero — Vector hero animation
// ═══════════════════════════════════════════════════════════════
// Two document sheets (left/right) with thin connector paths
// flowing into a glowing brain at the center. Pulse particles
// travel along the paths; subtle breathing glow surrounds the brain.
//
// HARD CONTRACTS:
//   - SVG + React + framer-motion only. No canvas, no video.
//   - No hardcoded visible text inside the SVG.
//   - 12-language safe (purely visual).
//   - Respects prefers-reduced-motion.
//   - Crisp at any size; preserveAspectRatio handles responsive.
// ═══════════════════════════════════════════════════════════════

import { memo, useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AIDataFlowHeroProps {
  className?: string;
  /** Visual intensity: 'calm' = slower, fewer particles; 'normal' = default; 'lively' = more energy. */
  intensity?: "calm" | "normal" | "lively";
  /** Optional aria-label for assistive tech. Pass a localized string from i18n; never hardcode here. */
  ariaLabel?: string;
}

const VIEWBOX_W = 800;
const VIEWBOX_H = 360;

// Connector paths from each document corner toward the brain center.
// Designed as gentle bezier curves — symmetric on both sides.
const LEFT_PATHS = [
  "M 175 130 C 260 130, 320 165, 380 180",
  "M 180 165 C 260 175, 320 178, 380 180",
  "M 180 200 C 260 200, 320 195, 380 185",
];
const RIGHT_PATHS = [
  "M 625 130 C 540 130, 480 165, 420 180",
  "M 620 165 C 540 175, 480 178, 420 180",
  "M 620 200 C 540 200, 480 195, 420 185",
];

const INTENSITY_MAP = {
  calm:   { particleDuration: 4.6, particleCount: 1, glowDuration: 5.2 },
  normal: { particleDuration: 3.4, particleCount: 2, glowDuration: 4.0 },
  lively: { particleDuration: 2.4, particleCount: 3, glowDuration: 3.0 },
} as const;

function AIDataFlowHeroComponent({
  className,
  intensity = "normal",
  ariaLabel,
}: AIDataFlowHeroProps) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const cfg = INTENSITY_MAP[intensity];

  // Stable per-mount IDs to avoid SSR/CSR collisions.
  const ids = useMemo(
    () => ({
      brainGrad: `aidf-brain-${uid}`,
      glow: `aidf-glow-${uid}`,
      paperShadow: `aidf-paper-${uid}`,
      lineGrad: `aidf-line-${uid}`,
      pulseGrad: `aidf-pulse-${uid}`,
    }),
    [uid],
  );

  const allPaths = [...LEFT_PATHS, ...RIGHT_PATHS];

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
          {/* Brain gradient — uses semantic tokens via currentColor inheritance */}
          <radialGradient id={ids.brainGrad} cx="50%" cy="50%" r="60%">
            <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.95" />
            <stop offset="60%"  stopColor="hsl(var(--primary))" stopOpacity="0.55" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
          </radialGradient>

          {/* Soft glow */}
          <radialGradient id={ids.glow} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.35" />
            <stop offset="60%"  stopColor="hsl(var(--primary))" stopOpacity="0.10" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>

          {/* Connector line gradient — fades toward edges */}
          <linearGradient id={ids.lineGrad} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.05" />
            <stop offset="50%"  stopColor="hsl(var(--primary))" stopOpacity="0.55" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
          </linearGradient>

          {/* Paper drop shadow */}
          <filter id={ids.paperShadow} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="3" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.18" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Pulse particle radial */}
          <radialGradient id={ids.pulseGrad} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop offset="60%"  stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ═══ Glow layer (behind brain) ═══ */}
        <g>
          {reduceMotion ? (
            <circle cx={VIEWBOX_W / 2} cy={VIEWBOX_H / 2} r="120" fill={`url(#${ids.glow})`} />
          ) : (
            <motion.circle
              cx={VIEWBOX_W / 2}
              cy={VIEWBOX_H / 2}
              r="120"
              fill={`url(#${ids.glow})`}
              animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
              transition={{
                duration: cfg.glowDuration,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{ transformOrigin: `${VIEWBOX_W / 2}px ${VIEWBOX_H / 2}px` }}
            />
          )}
        </g>

        {/* ═══ Documents layer ═══ */}
        <g>
          <DocumentSheet
            x={90}
            y={95}
            accent="hsl(var(--primary))"
            shadowId={ids.paperShadow}
            float={!reduceMotion}
            floatDelay={0}
          />
          <DocumentSheet
            x={620}
            y={95}
            accent="hsl(var(--primary))"
            shadowId={ids.paperShadow}
            float={!reduceMotion}
            floatDelay={1.2}
            mirrored
          />
        </g>

        {/* ═══ Connectors layer ═══ */}
        <g fill="none" strokeLinecap="round">
          {allPaths.map((d, i) => (
            <ConnectorPath
              key={`p-${i}`}
              d={d}
              gradientId={ids.lineGrad}
              animate={!reduceMotion}
              delay={i * 0.18}
            />
          ))}
        </g>

        {/* ═══ Pulse particles layer ═══ */}
        {!reduceMotion && (
          <g>
            {allPaths.map((d, i) =>
              Array.from({ length: cfg.particleCount }).map((_, k) => (
                <PulseParticle
                  key={`pulse-${i}-${k}`}
                  pathD={d}
                  duration={cfg.particleDuration}
                  delay={(i * 0.35) + (k * (cfg.particleDuration / cfg.particleCount))}
                  gradientId={ids.pulseGrad}
                  reverse={false}
                />
              )),
            )}
            {/* subtle return pulses outward (slower, fewer) */}
            {allPaths.map((d, i) => (
              <PulseParticle
                key={`return-${i}`}
                pathD={d}
                duration={cfg.particleDuration * 1.6}
                delay={i * 0.5 + 1.2}
                gradientId={ids.pulseGrad}
                reverse
                small
              />
            ))}
          </g>
        )}

        {/* ═══ Brain layer ═══ */}
        <g transform={`translate(${VIEWBOX_W / 2}, ${VIEWBOX_H / 2})`}>
          <BrainShape gradientId={ids.brainGrad} animate={!reduceMotion} />
        </g>
      </svg>
    </div>
  );
}

export const AIDataFlowHero = memo(AIDataFlowHeroComponent);

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

interface DocumentSheetProps {
  x: number;
  y: number;
  accent: string;
  shadowId: string;
  float: boolean;
  floatDelay: number;
  mirrored?: boolean;
}

function DocumentSheet({ x, y, shadowId, float, floatDelay, mirrored }: DocumentSheetProps) {
  const W = 90;
  const H = 110;

  const sheet = (
    <g filter={`url(#${shadowId})`}>
      {/* Page body */}
      <rect
        x={0}
        y={0}
        width={W}
        height={H}
        rx={6}
        fill="hsl(var(--card))"
        stroke="hsl(var(--border))"
        strokeWidth={1}
      />
      {/* Folded corner */}
      <path
        d={mirrored
          ? `M 0 0 L 14 0 L 0 14 Z`
          : `M ${W} 0 L ${W - 14} 0 L ${W} 14 Z`}
        fill="hsl(var(--muted))"
      />
      {/* Content lines (purely decorative — no text) */}
      <g stroke="hsl(var(--muted-foreground))" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round">
        <line x1="14" y1="32" x2={W - 14} y2="32" />
        <line x1="14" y1="44" x2={W - 22} y2="44" />
        <line x1="14" y1="56" x2={W - 14} y2="56" />
        <line x1="14" y1="68" x2={W - 28} y2="68" />
      </g>
      {/* Accent badge */}
      <rect x="14" y="84" width="34" height="14" rx="3" fill="hsl(var(--primary) / 0.12)" />
      {/* Check dot */}
      <circle cx={W - 18} cy={92} r="6" fill="hsl(var(--primary))" />
      <path
        d={`M ${W - 21} 92 L ${W - 19} 94 L ${W - 15} 90`}
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );

  if (!float) {
    return <g transform={`translate(${x}, ${y})`}>{sheet}</g>;
  }

  return (
    <motion.g
      transform={`translate(${x}, ${y})`}
      animate={{ y: [0, -3, 0, 3, 0] }}
      transition={{
        duration: 7,
        repeat: Infinity,
        ease: "easeInOut",
        delay: floatDelay,
      }}
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
        strokeWidth={1.2}
        strokeDasharray="3 4"
        opacity={0.6}
      />
    );
  }
  return (
    <motion.path
      d={d}
      stroke={`url(#${gradientId})`}
      strokeWidth={1.2}
      strokeDasharray="3 4"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.7 }}
      transition={{
        pathLength: { duration: 1.6, delay, ease: "easeInOut" },
        opacity: { duration: 0.6, delay },
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
  const r = small ? 1.8 : 2.6;
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

interface BrainShapeProps {
  gradientId: string;
  animate: boolean;
}

function BrainShape({ gradientId, animate }: BrainShapeProps) {
  // Stylized brain — two lobes with internal sulci lines.
  const brain = (
    <>
      {/* Outer brain silhouette */}
      <path
        d="
          M 0 -55
          C -18 -55, -38 -45, -42 -25
          C -52 -18, -55 -5, -50 8
          C -55 18, -45 32, -32 36
          C -22 50, -8 52, 0 46
          C 8 52, 22 50, 32 36
          C 45 32, 55 18, 50 8
          C 55 -5, 52 -18, 42 -25
          C 38 -45, 18 -55, 0 -55 Z
        "
        fill={`url(#${gradientId})`}
        stroke="hsl(var(--primary))"
        strokeOpacity="0.45"
        strokeWidth="1.2"
      />
      {/* Central fissure */}
      <line x1="0" y1="-52" x2="0" y2="48" stroke="hsl(var(--primary))" strokeOpacity="0.35" strokeWidth="1.2" />
      {/* Left lobe sulci */}
      <path d="M -10 -38 C -22 -34, -28 -22, -24 -12" stroke="hsl(var(--primary))" strokeOpacity="0.4" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M -8 -18 C -22 -14, -30 -2, -22 8" stroke="hsl(var(--primary))" strokeOpacity="0.4" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M -10 6 C -22 10, -28 22, -18 30" stroke="hsl(var(--primary))" strokeOpacity="0.4" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* Right lobe sulci */}
      <path d="M 10 -38 C 22 -34, 28 -22, 24 -12" stroke="hsl(var(--primary))" strokeOpacity="0.4" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M 8 -18 C 22 -14, 30 -2, 22 8" stroke="hsl(var(--primary))" strokeOpacity="0.4" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M 10 6 C 22 10, 28 22, 18 30" stroke="hsl(var(--primary))" strokeOpacity="0.4" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* Tiny inner dots */}
      <circle cx="-14" cy="-8" r="1.3" fill="hsl(var(--primary))" opacity="0.6" />
      <circle cx="14"  cy="10" r="1.3" fill="hsl(var(--primary))" opacity="0.6" />
      <circle cx="-6"  cy="22" r="1.3" fill="hsl(var(--primary))" opacity="0.6" />
    </>
  );

  if (!animate) return <g>{brain}</g>;

  return (
    <motion.g
      animate={{ scale: [1, 1.025, 1] }}
      transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
    >
      {brain}
    </motion.g>
  );
}
