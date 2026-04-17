// ═══════════════════════════════════════════════════════════════
// AIDataFlowHero — Multi-document Analysis Hero (visual only)
// ═══════════════════════════════════════════════════════════════
// Visual source of truth: editorial line-art reference image.
//   - Two clusters of clean white documents (5+ per side via fan + bg layers)
//   - Thin dark curved connectors with arrowheads pointing INWARD to brain
//   - Small dark "document chip" rectangles riding mid-path along connectors
//   - Center: anatomical brain (two hemispheres) with cool purple/blue glow
//   - Tiny sparkle particles around the glow
//
// HARD CONTRACTS:
//   - SVG + React + framer-motion only (no canvas/video/lottie)
//   - No hardcoded visible text. 12-language safe.
//   - prefers-reduced-motion respected.
//   - Not connected to the reading engine.
// ═══════════════════════════════════════════════════════════════

import { memo, useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AIDataFlowHeroProps {
  className?: string;
  /** 'calm' | 'normal' | 'lively' — controls motion speed + sparkle density */
  intensity?: "calm" | "normal" | "lively";
  /** Localized aria-label */
  ariaLabel?: string;
  /** Max visible cards per side cap (fan supports up to 5) */
  visibleCardsPerSide?: number;
  /** STATE: number of uploaded files (drives doc count per side) */
  fileCount?: number;
  /** STATE: any files exist → render document clusters + connectors */
  hasFiles?: boolean;
  /** STATE: user is dragging files over the dropzone */
  isDragOver?: boolean;
  /** STATE: upload/extraction in progress → animate chips faster */
  isProcessing?: boolean;
}

const VIEWBOX_W = 960;
const VIEWBOX_H = 720;
const CX = VIEWBOX_W / 2;
const CY = VIEWBOX_H / 2;

const INTENSITY_MAP = {
  calm:   { chipDuration: 5.4, glowDuration: 5.6, sparkleCount: 6  },
  normal: { chipDuration: 4.0, glowDuration: 4.4, sparkleCount: 10 },
  lively: { chipDuration: 2.8, glowDuration: 3.4, sparkleCount: 14 },
} as const;

// Document geometry
const CARD_W = 132;
const CARD_H = 168;

// Fan offsets per side — supports up to 5 cards (front-most last for stacking)
const FAN: Array<{ dx: number; dy: number; rotate: number; scale: number; opacity: number }> = [
  { dx: -38, dy:  28, rotate: -10, scale: 0.86, opacity: 0.55 },
  { dx: -22, dy: -18, rotate:  -5, scale: 0.92, opacity: 0.78 },
  { dx:   0, dy:  16, rotate:   2, scale: 0.97, opacity: 0.92 },
  { dx:  20, dy:  -8, rotate:   6, scale: 1.0,  opacity: 1.0  },
  { dx:  42, dy:  22, rotate:  11, scale: 0.94, opacity: 0.85 },
];

// Background "implied more" silhouettes (very faint)
const BG_LAYERS_LEFT = [
  { x:  40, y:  70, rotate: -18, opacity: 0.10, scale: 0.78 },
  { x:  18, y: 220, rotate: -22, opacity: 0.08, scale: 0.72 },
  { x:  90, y: 290, rotate:  -6, opacity: 0.10, scale: 0.78 },
];
const BG_LAYERS_RIGHT = [
  { x: 790, y:  70, rotate:  18, opacity: 0.10, scale: 0.78 },
  { x: 832, y: 220, rotate:  22, opacity: 0.08, scale: 0.72 },
  { x: 740, y: 300, rotate:   6, opacity: 0.10, scale: 0.78 },
];

function AIDataFlowHeroComponent({
  className,
  intensity = "normal",
  ariaLabel,
  visibleCardsPerSide = 3,
  fileCount = 0,
  hasFiles = false,
  isDragOver = false,
  isProcessing = false,
}: AIDataFlowHeroProps) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  // Derive intensity from state when processing
  const effectiveIntensity = isProcessing ? "lively" : isDragOver ? "normal" : intensity;
  const cfg = INTENSITY_MAP[effectiveIntensity];

  // STRICT state machine — documents are derived ONLY from real fileCount.
  // Idle (fileCount=0, !isProcessing): brain only. No docs, no connectors, no chips.
  // Drag-over (fileCount=0): subtle hint ring only. Still no permanent docs.
  // hasFiles / isProcessing: render docs + connectors. Chips animate while processing.
  const totalDocs = Math.max(0, Math.floor(fileCount));
  const showDocuments = totalDocs > 0;
  const showConnectors = showDocuments;
  const showChips = showDocuments && isProcessing;
  const dragHint = isDragOver && !showDocuments;

  const ids = useMemo(
    () => ({
      glow:        `aidf-glow-${uid}`,
      glowInner:   `aidf-glowi-${uid}`,
      paperShadow: `aidf-paper-${uid}`,
      arrowHead:   `aidf-arrow-${uid}`,
      sparkle:     `aidf-spark-${uid}`,
    }),
    [uid],
  );

  // Cluster anchor points
  const LEFT_ANCHOR  = { x: 168, y: 180 };
  const RIGHT_ANCHOR = { x: 660, y: 180 };

  // Distribute REAL fileCount across two sides; cap by visibleCardsPerSide (≤5).
  // No fallback — if totalDocs is 0, both sides are 0 and nothing renders.
  const maxPerSide = Math.max(1, Math.min(5, visibleCardsPerSide));
  const lc = Math.min(maxPerSide, Math.ceil(totalDocs / 2));
  const rc = Math.min(maxPerSide, Math.floor(totalDocs / 2));
  const cardsPerSide = Math.max(lc, rc, 1);

  const leftCards = FAN.slice(0, lc).map((f, i) => ({
    ...f,
    x: LEFT_ANCHOR.x + f.dx,
    y: LEFT_ANCHOR.y + f.dy,
    index: i,
  }));
  const rightCards = FAN.slice(0, rc).map((f, i) => ({
    ...f,
    x: RIGHT_ANCHOR.x + f.dx,
    y: RIGHT_ANCHOR.y + f.dy,
    index: i,
  }));

  // Connector paths — gentle S-curves from each card's inner edge to brain
  const connectors = useMemo(() => {
    const paths: Array<{ d: string; key: string; side: "L" | "R" }> = [];

    leftCards.forEach((c, i) => {
      const sx = c.x + CARD_W;                          // right edge of left card
      const sy = c.y + CARD_H * 0.45;
      const ex = CX - 70;                                // brain left edge
      const ey = CY + (i - (cardsPerSide - 1) / 2) * 14;
      const c1x = sx + 70;
      const c1y = sy + (i - (cardsPerSide - 1) / 2) * 6;
      const c2x = ex - 60;
      const c2y = ey;
      paths.push({
        d: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`,
        key: `L-${i}`,
        side: "L",
      });
    });

    rightCards.forEach((c, i) => {
      const sx = c.x;                                    // left edge of right card
      const sy = c.y + CARD_H * 0.45;
      const ex = CX + 70;                                // brain right edge
      const ey = CY + (i - (cardsPerSide - 1) / 2) * 14;
      const c1x = sx - 70;
      const c1y = sy + (i - (cardsPerSide - 1) / 2) * 6;
      const c2x = ex + 60;
      const c2y = ey;
      paths.push({
        d: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`,
        key: `R-${i}`,
        side: "R",
      });
    });

    return paths;
  }, [cardsPerSide, leftCards, rightCards]);

  // Sparkle positions around brain glow
  const sparkles = useMemo(() => {
    const arr: Array<{ x: number; y: number; r: number; delay: number }> = [];
    for (let i = 0; i < cfg.sparkleCount; i++) {
      const angle = (i / cfg.sparkleCount) * Math.PI * 2 + (i * 0.37);
      const radius = 95 + ((i * 17) % 55);
      arr.push({
        x: CX + Math.cos(angle) * radius,
        y: CY + Math.sin(angle) * radius * 0.78,
        r: 0.9 + ((i * 7) % 18) / 18,
        delay: (i * 0.31) % 3,
      });
    }
    return arr;
  }, [cfg.sparkleCount]);

  return (
    <div className={cn("relative w-full select-none", className)}>
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="block w-full h-auto overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={ariaLabel}
        aria-hidden={ariaLabel ? undefined : true}
      >
        <defs>
          {/* Outer breathing glow — cool purple/blue */}
          <radialGradient id={ids.glow} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="hsl(265 90% 70%)" stopOpacity="0.55" />
            <stop offset="40%"  stopColor="hsl(245 90% 70%)" stopOpacity="0.28" />
            <stop offset="75%"  stopColor="hsl(210 90% 70%)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="hsl(210 90% 70%)" stopOpacity="0" />
          </radialGradient>

          {/* Inner hot core */}
          <radialGradient id={ids.glowInner} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="hsl(280 100% 88%)" stopOpacity="0.95" />
            <stop offset="35%"  stopColor="hsl(260 95% 78%)"  stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(220 95% 75%)"  stopOpacity="0" />
          </radialGradient>

          {/* Sparkle */}
          <radialGradient id={ids.sparkle} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="hsl(280 100% 92%)" stopOpacity="1" />
            <stop offset="60%"  stopColor="hsl(260 95% 80%)"  stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(260 95% 80%)"  stopOpacity="0" />
          </radialGradient>

          {/* Paper shadow */}
          <filter id={ids.paperShadow} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="3" result="o" />
            <feComponentTransfer><feFuncA type="linear" slope="0.16" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Arrowhead marker (editorial dark) */}
          <marker
            id={ids.arrowHead}
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" fill="hsl(var(--foreground))" fillOpacity="0.78" />
          </marker>
        </defs>

        {/* ═══ Background document silhouettes (only when documents exist) ═══ */}
        {showDocuments && (
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
                  rx={6}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--foreground))"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
              </g>
            ))}
          </g>
        )}

        {/* ═══ Glow halo behind atom (only when active: drag/files/processing) ═══ */}
        {(showDocuments || dragHint) && (
          <g>
            {reduceMotion ? (
              <>
                <circle cx={CX} cy={CY} r="170" fill={`url(#${ids.glow})`} />
                <circle cx={CX} cy={CY} r="80"  fill={`url(#${ids.glowInner})`} />
              </>
            ) : (
              <>
                <motion.circle
                  cx={CX}
                  cy={CY}
                  r="170"
                  fill={`url(#${ids.glow})`}
                  animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
                  transition={{ duration: cfg.glowDuration, repeat: Infinity, ease: "easeInOut" }}
                  style={{ transformOrigin: `${CX}px ${CY}px` }}
                />
                <motion.circle
                  cx={CX}
                  cy={CY}
                  r="80"
                  fill={`url(#${ids.glowInner})`}
                  animate={{ scale: [1, 1.12, 1], opacity: [0.75, 1, 0.75] }}
                  transition={{ duration: cfg.glowDuration * 0.7, repeat: Infinity, ease: "easeInOut" }}
                  style={{ transformOrigin: `${CX}px ${CY}px` }}
                />
              </>
            )}
          </g>
        )}

        {/* ═══ Sparkles (only when active) ═══ */}
        {!reduceMotion && (showDocuments || dragHint) && (
          <g>
            {sparkles.map((s, i) => (
              <motion.circle
                key={`sp-${i}`}
                cx={s.x}
                cy={s.y}
                r={s.r}
                fill={`url(#${ids.sparkle})`}
                animate={{ opacity: [0, 1, 0], scale: [0.6, 1.4, 0.6] }}
                transition={{
                  duration: 2.4 + (i % 4) * 0.6,
                  repeat: Infinity,
                  delay: s.delay,
                  ease: "easeInOut",
                }}
                style={{ transformOrigin: `${s.x}px ${s.y}px` }}
              />
            ))}
          </g>
        )}

        {/* ═══ Connector paths with arrowheads (only when documents exist) ═══ */}
        {showConnectors && (
          <g fill="none" strokeLinecap="round">
            {connectors.map((p, i) => (
              <ConnectorPath
                key={p.key}
                d={p.d}
                animate={!reduceMotion}
                delay={i * 0.1}
                markerId={ids.arrowHead}
              />
            ))}
          </g>
        )}

        {/* ═══ Mid-flight extraction chips (only while processing) ═══ */}
        {showChips && !reduceMotion && (
          <g>
            {connectors.map((p, i) => (
              <DocumentChip
                key={`chip-${p.key}`}
                pathD={p.d}
                duration={cfg.chipDuration}
                delay={(i * 0.45) % cfg.chipDuration}
              />
            ))}
          </g>
        )}

        {/* ═══ Document clusters (only when files exist) ═══ */}
        {showDocuments && (
          <g>
            {leftCards.map((c, i) => (
              <DocumentCard
                key={`L-${i}-of-${totalDocs}`}
                x={c.x}
                y={c.y}
                rotate={c.rotate}
                scale={c.scale}
                opacity={c.opacity}
                shadowId={ids.paperShadow}
                accentVariant={i % 3}
                float={!reduceMotion}
                floatDelay={i * 0.45}
                mirrored={false}
                emergeFromX={CX - CARD_W / 2}
                emergeFromY={VIEWBOX_H - 40}
                emergeDelay={i * 0.12}
              />
            ))}
            {rightCards.map((c, i) => (
              <DocumentCard
                key={`R-${i}-of-${totalDocs}`}
                x={c.x}
                y={c.y}
                rotate={-c.rotate}
                scale={c.scale}
                opacity={c.opacity}
                shadowId={ids.paperShadow}
                accentVariant={(i + 1) % 3}
                float={!reduceMotion}
                floatDelay={i * 0.45 + 0.7}
                mirrored
                emergeFromX={CX - CARD_W / 2}
                emergeFromY={VIEWBOX_H - 40}
                emergeDelay={i * 0.12 + 0.06}
              />
            ))}
          </g>
        )}

        {/* ═══ Drag-over hint: subtle inward pulse ring around brain ═══ */}
        {dragHint && !reduceMotion && (
          <motion.circle
            cx={CX}
            cy={CY}
            r={130}
            fill="none"
            stroke="hsl(265 90% 70%)"
            strokeOpacity={0.4}
            strokeWidth={1.2}
            strokeDasharray="4 6"
            animate={{ r: [150, 110, 150], opacity: [0.15, 0.55, 0.15] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* ═══ Brain (lucide-react icon — same as used elsewhere in app) ═══ */}
        <g transform={`translate(${CX}, ${CY})`}>
          <BrainShape animate={!reduceMotion} />
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
  /** Emerge-from-user origin (bottom-center of viewbox) */
  emergeFromX?: number;
  emergeFromY?: number;
  /** Stagger for emerge entrance */
  emergeDelay?: number;
}

function DocumentCard({
  x, y, rotate, scale, opacity, shadowId, accentVariant, float, floatDelay, mirrored,
  emergeFromX, emergeFromY, emergeDelay = 0,
}: DocumentCardProps) {
  const W = CARD_W;
  const H = CARD_H;

  // Multiple short text-line groups for a denser editorial feel
  const lineRows = [
    { yStart: 44, count: 8, gap: 9 },
  ];

  // Variant defines header/footer block presence
  const showHeaderBlock = accentVariant !== 1;
  const showFooterBlocks = accentVariant !== 2;

  const sheet = (
    <g filter={`url(#${shadowId})`}>
      {/* Page */}
      <rect
        width={W}
        height={H}
        rx={6}
        fill="hsl(var(--card))"
        stroke="hsl(var(--foreground))"
        strokeOpacity={0.55}
        strokeWidth={1.1}
      />
      {/* Folded corner */}
      <path
        d={mirrored
          ? `M 0 0 L 18 0 L 0 18 Z`
          : `M ${W} 0 L ${W - 18} 0 L ${W} 18 Z`}
        fill="hsl(var(--muted))"
      />
      {/* Header dark block (like reference) */}
      {showHeaderBlock && (
        <rect
          x={mirrored ? 22 : 14}
          y={16}
          width={W * 0.5}
          height={10}
          rx={1.5}
          fill="hsl(var(--foreground))"
          fillOpacity={0.82}
        />
      )}
      {/* Body lines */}
      <g
        stroke="hsl(var(--foreground))"
        strokeOpacity={0.42}
        strokeWidth={1}
        strokeLinecap="round"
      >
        {lineRows.map((row) =>
          Array.from({ length: row.count }).map((_, i) => {
            const widths = [W - 22, W - 30, W - 18, W - 36, W - 24, W - 40, W - 26, W - 32];
            const w = widths[(i + accentVariant) % widths.length];
            return (
              <line
                key={`ln-${i}`}
                x1={12}
                y1={row.yStart + i * row.gap}
                x2={w}
                y2={row.yStart + i * row.gap}
              />
            );
          }),
        )}
      </g>
      {/* Inline emphasis block mid-page (like reference) */}
      <rect
        x={mirrored ? W - 64 : 38}
        y={H * 0.52}
        width={42}
        height={10}
        rx={1.5}
        fill="hsl(var(--foreground))"
        fillOpacity={0.82}
      />
      {/* Footer blocks */}
      {showFooterBlocks && (
        <>
          <rect
            x={14}
            y={H - 28}
            width={28}
            height={9}
            rx={1.5}
            fill="hsl(var(--foreground))"
            fillOpacity={0.82}
          />
          <rect
            x={48}
            y={H - 28}
            width={42}
            height={9}
            rx={1.5}
            fill="hsl(var(--foreground))"
            fillOpacity={0.82}
          />
        </>
      )}
    </g>
  );

  const settledTransform = `translate(${x}, ${y}) rotate(${rotate} ${W / 2} ${H / 2}) scale(${scale})`;
  const fromX = emergeFromX ?? x;
  const fromY = emergeFromY ?? y;
  const emergeFromTransform = `translate(${fromX}, ${fromY}) rotate(0 ${W / 2} ${H / 2}) scale(0.2)`;

  if (!float) {
    return <g transform={settledTransform} opacity={opacity}>{sheet}</g>;
  }

  return (
    <motion.g
      initial={{ transform: emergeFromTransform, opacity: 0 }}
      animate={{
        transform: settledTransform,
        opacity,
        y: [0, -2.2, 0, 2.2, 0],
      }}
      transition={{
        transform: { duration: 0.9, delay: emergeDelay, ease: [0.16, 1, 0.3, 1] },
        opacity:   { duration: 0.5, delay: emergeDelay, ease: "easeOut" },
        y: { duration: 9, repeat: Infinity, ease: "easeInOut", delay: floatDelay + emergeDelay + 0.9 },
      }}
    >
      {sheet}
    </motion.g>
  );
}

interface ConnectorPathProps {
  d: string;
  animate: boolean;
  delay: number;
  markerId: string;
}

function ConnectorPath({ d, animate, delay, markerId }: ConnectorPathProps) {
  const stroke = "hsl(var(--foreground))";
  const common = {
    d,
    stroke,
    strokeOpacity: 0.72,
    strokeWidth: 1.4,
    fill: "none" as const,
    markerEnd: `url(#${markerId})`,
  };

  if (!animate) {
    return <path {...common} />;
  }
  return (
    <motion.path
      {...common}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.78 }}
      transition={{
        pathLength: { duration: 1.4, delay, ease: "easeInOut" },
        opacity:    { duration: 0.5, delay },
      }}
    />
  );
}

interface DocumentChipProps {
  pathD: string;
  duration: number;
  delay: number;
}

/**
 * Small dark rectangle chip that rides the connector path,
 * mimicking a "document fragment" being delivered to the brain.
 * Appears mid-path, fades out before the arrowhead.
 */
function DocumentChip({ pathD, duration, delay }: DocumentChipProps) {
  const W = 14;
  const H = 6;
  return (
    <g>
      <rect
        x={-W / 2}
        y={-H / 2}
        width={W}
        height={H}
        rx={1}
        fill="hsl(var(--foreground))"
        fillOpacity={0.85}
      >
        <animateMotion
          dur={`${duration}s`}
          repeatCount="indefinite"
          begin={`${delay}s`}
          path={pathD}
          rotate="auto"
          keyPoints="0.15;0.78"
          keyTimes="0;1"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          keyTimes="0;0.18;0.78;1"
          dur={`${duration}s`}
          begin={`${delay}s`}
          repeatCount="indefinite"
        />
      </rect>
    </g>
  );
}

interface BrainShapeProps {
  animate: boolean;
}

/**
 * Brain-centered metaphor — locked. Uses the same lucide-react Brain icon
 * used elsewhere in the app (About, OrxRankHub, etc.). Rendered inside SVG
 * via foreignObject so the rest of the scene stays pure SVG.
 */
function BrainShape({ animate }: BrainShapeProps) {
  const SIZE = 630;
  const icon = (
    <foreignObject x={-SIZE / 2} y={-SIZE / 2} width={SIZE} height={SIZE}>
      <div
        style={{
          width: SIZE,
          height: SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "hsl(265 85% 60%)",
        }}
      >
        <Brain size={SIZE} strokeWidth={1.4} absoluteStrokeWidth />
      </div>
    </foreignObject>
  );

  if (!animate) return <g>{icon}</g>;

  return (
    <motion.g
      animate={{ scale: [1, 1.03, 1] }}
      transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
    >
      {icon}
    </motion.g>
  );
}
