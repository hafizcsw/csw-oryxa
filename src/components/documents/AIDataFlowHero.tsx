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

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export type AIDataFlowHeroFileStatus = "pending" | "active" | "done" | "failed";

export interface AIDataFlowHeroFile {
  name: string;
  /** Real backend processing status. Defaults to 'active' if omitted. */
  status?: AIDataFlowHeroFileStatus;
}

export interface AIDataFlowHeroProps {
  className?: string;
  /** 'calm' | 'normal' | 'lively' — controls motion speed + sparkle density */
  intensity?: "calm" | "normal" | "lively";
  /** Localized aria-label */
  ariaLabel?: string;
  /** Max visible cards per side cap (fan supports up to 5) */
  visibleCardsPerSide?: number;
  /** STATE: real list of uploaded files — drives doc cards + filenames + scan order */
  files?: AIDataFlowHeroFile[];
  /** STATE: number of uploaded files (fallback if `files` not provided) */
  fileCount?: number;
  /** STATE: any files exist → render document clusters + connectors */
  hasFiles?: boolean;
  /** STATE: user is dragging files over the dropzone */
  isDragOver?: boolean;
  /** STATE: upload/extraction in progress → animate chips faster */
  isProcessing?: boolean;
}

/** Time per file scan, ms */
const SCAN_DURATION_MS = 2600;
/** Gap between files, ms */
const SCAN_GAP_MS = 200;

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
  visibleCardsPerSide = 5,
  files,
  fileCount = 0,
  hasFiles = false,
  isDragOver = false,
  isProcessing = false,
}: AIDataFlowHeroProps) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const { t } = useLanguage();

  // Derive intensity from state when processing
  const effectiveIntensity = isProcessing ? "lively" : isDragOver ? "normal" : intensity;
  const cfg = INTENSITY_MAP[effectiveIntensity];

  // STRICT state machine — documents are derived ONLY from real files/fileCount.
  const fileList: AIDataFlowHeroFile[] = useMemo(() => {
    if (files && files.length > 0) return files;
    const n = Math.max(0, Math.floor(fileCount));
    return Array.from({ length: n }).map((_, i) => ({ name: `Document ${i + 1}` }));
  }, [files, fileCount]);

  const totalDocs = fileList.length;
  const showDocuments = totalDocs > 0;
  const dragHint = isDragOver && !showDocuments;

  // ───── Sequential scan state machine ─────
  // activeIndex advances every SCAN_DURATION_MS + SCAN_GAP_MS while there are
  // still un-scanned files. When new files arrive after completion, resume.
  const [activeIndex, setActiveIndex] = useState(0);
  const prevTotalRef = useRef(0);

  useEffect(() => {
    // If new files were added after we finished, resume from the first new index
    if (totalDocs > prevTotalRef.current && activeIndex >= prevTotalRef.current) {
      setActiveIndex(prevTotalRef.current);
    }
    // If total dropped to 0, reset
    if (totalDocs === 0) {
      setActiveIndex(0);
    }
    prevTotalRef.current = totalDocs;
  }, [totalDocs, activeIndex]);

  useEffect(() => {
    if (totalDocs === 0) return;
    if (activeIndex >= totalDocs) return; // all done
    if (reduceMotion) {
      // No animation: mark all done immediately
      setActiveIndex(totalDocs);
      return;
    }
    const timer = window.setTimeout(() => {
      setActiveIndex((idx) => Math.min(idx + 1, totalDocs));
    }, SCAN_DURATION_MS + SCAN_GAP_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, totalDocs, reduceMotion]);

  const allDone = totalDocs > 0 && activeIndex >= totalDocs;

  // Brain stays shrunk while any file is pending or active. Returns to full
  // size once the last file is scanned.
  const brainShrink = showDocuments && !allDone;

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

  // Cluster anchor X (column) per side
  const LEFT_X  = 40;
  const RIGHT_X = 790;

  // Distribute REAL fileCount across two sides; cap by visibleCardsPerSide (≤5).
  const maxPerSide = Math.max(1, Math.min(5, visibleCardsPerSide));
  const lc = Math.min(maxPerSide, Math.ceil(totalDocs / 2));
  const rc = Math.min(maxPerSide, Math.floor(totalDocs / 2));
  const cardsPerSide = Math.max(lc, rc, 1);

  // Helper: evenly distribute N cards vertically within the viewbox column.
  // Returns positions including the GLOBAL file index (gIdx) so we can map
  // each card to its file in `fileList` and to scan state.
  const distributeColumn = (
    count: number,
    anchorX: number,
    mirrored: boolean,
    gIdxStart: number,
  ) => {
    if (count === 0)
      return [] as Array<{ x: number; y: number; rotate: number; scale: number; opacity: number; index: number; gIdx: number }>;
    const TOP = 60;
    const BOTTOM = VIEWBOX_H - CARD_H - 60;
    const span = BOTTOM - TOP;
    return Array.from({ length: count }).map((_, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const y = TOP + span * t;
      const jitter = ((i % 2 === 0 ? 1 : -1) * (10 + (i * 7) % 14));
      const x = anchorX + (mirrored ? -jitter : jitter);
      const rotate = (mirrored ? -1 : 1) * (-6 + ((i * 5) % 12));
      return { x, y, rotate, scale: 1, opacity: 1, index: i, gIdx: gIdxStart + i };
    });
  };

  // Reading order: left column top→bottom (gIdx 0..lc-1), then right column (gIdx lc..lc+rc-1)
  const leftCards = distributeColumn(lc, LEFT_X, false, 0);
  const rightCards = distributeColumn(rc, RIGHT_X, true, lc);

  // Helper: compute per-card visual state from activeIndex
  const cardState = (gIdx: number): "pending" | "active" | "done" => {
    if (gIdx < activeIndex) return "done";
    if (gIdx === activeIndex) return "active";
    return "pending";
  };

  // Connector paths — generated for ALL cards, but rendered only for the
  // currently-active card so chips/arrows visibly switch from file to file.
  const connectors = useMemo(() => {
    const paths: Array<{ d: string; key: string; side: "L" | "R"; cardIdx: number; lineIdx: number; gIdx: number }> = [];
    const CARD_LINE_OFFSETS = [CARD_H * 0.28, CARD_H * 0.5, CARD_H * 0.72];

    leftCards.forEach((c, i) => {
      CARD_LINE_OFFSETS.forEach((yOff, li) => {
        const sx = c.x + CARD_W;
        const sy = c.y + yOff;
        const ex = CX - 70;
        const ey = CY + (i - (cardsPerSide - 1) / 2) * 18 + (li - 1) * 10;
        const c1x = sx + 80;
        const c1y = sy;
        const c2x = ex - 70;
        const c2y = ey;
        paths.push({
          d: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`,
          key: `L-${i}-${li}`,
          side: "L",
          cardIdx: i,
          lineIdx: li,
          gIdx: c.gIdx,
        });
      });
    });

    rightCards.forEach((c, i) => {
      CARD_LINE_OFFSETS.forEach((yOff, li) => {
        const sx = c.x;
        const sy = c.y + yOff;
        const ex = CX + 70;
        const ey = CY + (i - (cardsPerSide - 1) / 2) * 18 + (li - 1) * 10;
        const c1x = sx - 80;
        const c1y = sy;
        const c2x = ex + 70;
        const c2y = ey;
        paths.push({
          d: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`,
          key: `R-${i}-${li}`,
          side: "R",
          cardIdx: i,
          lineIdx: li,
          gIdx: c.gIdx,
        });
      });
    });

    return paths;
  }, [cardsPerSide, leftCards, rightCards]);

  // Only the active file's connectors stream into the brain.
  const activeConnectors = useMemo(
    () => connectors.filter((p) => p.gIdx === activeIndex),
    [connectors, activeIndex],
  );

  const showConnectors = showDocuments && !allDone;
  const showChips = showConnectors;

  // Localized micro-labels with safe fallbacks
  const scanningLabel = (() => {
    const v = t("hero.aiFlow.scanning");
    return typeof v === "string" && v && v !== "hero.aiFlow.scanning" ? v : "Scanning…";
  })();
  const scannedLabel = (() => {
    const v = t("hero.aiFlow.scanned");
    return typeof v === "string" && v && v !== "hero.aiFlow.scanned" ? v : "Scanned";
  })();

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

        {/* ═══ Connector paths — ONLY for the currently active file ═══ */}
        {showConnectors && (
          <g fill="none" strokeLinecap="round">
            {activeConnectors.map((p) => (
              <ConnectorPath
                key={`act-${p.key}-${activeIndex}`}
                d={p.d}
                animate={!reduceMotion}
                delay={0.15 + p.lineIdx * 0.08}
                markerId={ids.arrowHead}
              />
            ))}
          </g>
        )}

        {/* ═══ Mid-flight extraction chips — ONLY on active file's lines ═══ */}
        {showChips && !reduceMotion && (
          <g>
            {activeConnectors.map((p, i) => (
              <DocumentChip
                key={`chip-${p.key}-${activeIndex}`}
                pathD={p.d}
                duration={cfg.chipDuration}
                delay={(0.5 + p.lineIdx * 0.5 + (i * 0.15)) % cfg.chipDuration}
              />
            ))}
          </g>
        )}

        {/* ═══ Document clusters (only when files exist) ═══ */}
        {showDocuments && (
          <g>
            {leftCards.map((c, i) => {
              const st = cardState(c.gIdx);
              return (
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
                  label={fileList[c.gIdx]?.name ?? ""}
                  state={st}
                  scanDurationSec={SCAN_DURATION_MS / 1000}
                  scanningLabel={scanningLabel}
                  scannedLabel={scannedLabel}
                />
              );
            })}
            {rightCards.map((c, i) => {
              const st = cardState(c.gIdx);
              return (
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
                  label={fileList[c.gIdx]?.name ?? ""}
                  state={st}
                  scanDurationSec={SCAN_DURATION_MS / 1000}
                  scanningLabel={scanningLabel}
                  scannedLabel={scannedLabel}
                />
              );
            })}
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
          <BrainShape animate={!reduceMotion} shrink={brainShrink} />
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
  /** Real filename to display as the card title */
  label?: string;
  /** Sequential scan state */
  state?: "pending" | "active" | "done";
  /** Scan beam sweep duration (sec) — synced to outer scheduler */
  scanDurationSec?: number;
  /** Localized labels */
  scanningLabel?: string;
  scannedLabel?: string;
}

/** Truncate a filename for display (keep extension if short) */
function truncateName(name: string, max = 16): string {
  if (!name) return "";
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  if (dot > 0 && name.length - dot <= 5) {
    const ext = name.slice(dot);
    const head = name.slice(0, Math.max(1, max - ext.length - 1));
    return `${head}…${ext}`;
  }
  return `${name.slice(0, max - 1)}…`;
}

function DocumentCard({
  x, y, rotate, scale, opacity, shadowId, accentVariant, float, floatDelay, mirrored,
  emergeFromX, emergeFromY, emergeDelay = 0,
  label = "",
  state = "active",
  scanDurationSec = 2.6,
  scanningLabel = "Scanning…",
  scannedLabel = "Scanned",
}: DocumentCardProps) {
  const W = CARD_W;
  const H = CARD_H;

  const isActive = state === "active";
  const isDone = state === "done";
  const isPending = state === "pending";

  // Multiple short text-line groups for a denser editorial feel
  const lineRows = [
    { yStart: 56, count: 7, gap: 9 },
  ];

  // Variant defines footer block presence (header replaced by filename strip)
  const showFooterBlocks = accentVariant !== 2;

  // Card body opacity per state — pending dimmed, active/done fully visible
  const bodyOpacity = isPending ? 0.55 : 1;

  // Body line stroke — done = success-tinted, others = foreground
  const lineStroke = isDone ? "hsl(142 70% 42%)" : "hsl(var(--foreground))";
  const lineStrokeOpacity = isDone ? 0.55 : 0.42;

  const sheet = (
    <g filter={`url(#${shadowId})`} opacity={bodyOpacity}>
      {/* Page */}
      <rect
        width={W}
        height={H}
        rx={6}
        fill="hsl(var(--card))"
        stroke={isDone ? "hsl(142 70% 42%)" : "hsl(var(--foreground))"}
        strokeOpacity={isDone ? 0.7 : 0.55}
        strokeWidth={1.1}
      />
      {/* Folded corner */}
      <path
        d={mirrored
          ? `M 0 0 L 18 0 L 0 18 Z`
          : `M ${W} 0 L ${W - 18} 0 L ${W} 18 Z`}
        fill="hsl(var(--muted))"
      />
      {/* Filename strip — replaces generic header block */}
      <g>
        <rect
          x={8}
          y={8}
          width={W - 16}
          height={20}
          rx={3}
          fill="hsl(var(--foreground))"
          fillOpacity={isDone ? 0.7 : 0.85}
        />
        <text
          x={W / 2}
          y={22}
          textAnchor="middle"
          fontSize={9}
          fontWeight={600}
          fill="hsl(var(--background))"
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          {truncateName(label, 18)}
        </text>
      </g>

      {/* State micro-label under filename */}
      {(isActive || isDone) && (
        <g>
          {isActive && float ? (
            <motion.circle
              cx={mirrored ? W - 16 : 16}
              cy={40}
              r={3}
              fill="hsl(265 90% 60%)"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: `${mirrored ? W - 16 : 16}px 40px` }}
            />
          ) : isDone ? (
            <g transform={`translate(${mirrored ? W - 22 : 10}, 33)`}>
              <circle cx={6} cy={6} r={6} fill="hsl(142 70% 42%)" />
              <path
                d="M 3 6 L 5.2 8.2 L 9 4.2"
                stroke="hsl(var(--background))"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>
          ) : null}
          <text
            x={mirrored ? W - 24 : 24}
            y={43}
            textAnchor={mirrored ? "end" : "start"}
            fontSize={7.5}
            fill={isDone ? "hsl(142 70% 35%)" : "hsl(265 85% 55%)"}
            fontWeight={600}
            style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
          >
            {isDone ? scannedLabel : scanningLabel}
          </text>
        </g>
      )}

      {/* Body lines — shimmer ONLY when active; static otherwise */}
      <g
        stroke={lineStroke}
        strokeOpacity={lineStrokeOpacity}
        strokeWidth={1}
        strokeLinecap="round"
      >
        {lineRows.map((row) =>
          Array.from({ length: row.count }).map((_, i) => {
            const widths = [W - 22, W - 30, W - 18, W - 36, W - 24, W - 40, W - 26, W - 32];
            const w = widths[(i + accentVariant) % widths.length];
            return float && isActive ? (
              <motion.line
                key={`ln-${i}`}
                x1={12}
                y1={row.yStart + i * row.gap}
                y2={row.yStart + i * row.gap}
                initial={{ x2: 12 }}
                animate={{ x2: [12, w, w, 12] }}
                transition={{
                  duration: 3.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: (i * 0.18 + accentVariant * 0.3) % 2.4,
                  times: [0, 0.45, 0.85, 1],
                }}
              />
            ) : (
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
      {/* Inline emphasis block mid-page */}
      <rect
        x={mirrored ? W - 64 : 38}
        y={H * 0.62}
        width={42}
        height={10}
        rx={1.5}
        fill={isDone ? "hsl(142 70% 42%)" : "hsl(var(--foreground))"}
        fillOpacity={isDone ? 0.7 : 0.82}
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
      {/* Live scan beam — ONLY while this card is being actively scanned.
          Synced to outer scheduler: a single sweep top→bottom across SCAN_DURATION. */}
      {float && isActive && (
        <g clipPath={`inset(0 round 6px)`}>
          <motion.rect
            x={2}
            width={W - 4}
            height={18}
            rx={3}
            fill="hsl(265 90% 70%)"
            fillOpacity={0.32}
            initial={{ y: -20 }}
            animate={{ y: [-20, H - 14, H - 14] }}
            transition={{
              duration: scanDurationSec,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.85, 1],
            }}
          />
        </g>
      )}
    </g>
  );

  const settledTransform = `translate(${x}, ${y}) rotate(${rotate} ${W / 2} ${H / 2}) scale(${scale})`;
  const fromX = emergeFromX ?? x;
  const fromY = emergeFromY ?? y;
  // Emergence offset in the card's local (post-translate) coordinate space
  const emergeDX = fromX - x;
  const emergeDY = fromY - y;

  if (!float) {
    return <g transform={settledTransform} opacity={opacity}>{sheet}</g>;
  }

  return (
    <g transform={settledTransform} opacity={opacity}>
      <motion.g
        initial={{ scale: 0.2, opacity: 0, x: emergeDX, y: emergeDY }}
        animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
        transition={{
          duration: 0.9,
          delay: emergeDelay,
          ease: [0.16, 1, 0.3, 1],
          opacity: { duration: 0.5, delay: emergeDelay, ease: "easeOut" },
        }}
        style={{ transformOrigin: `${W / 2}px ${H / 2}px` }}
      >
        <motion.g
          animate={{ y: [0, -2.2, 0, 2.2, 0] }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: floatDelay + emergeDelay + 0.9,
          }}
        >
          {sheet}
        </motion.g>
      </motion.g>
    </g>
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
  shrink?: boolean;
}

/**
 * Brain-centered metaphor — locked. Uses the same lucide-react Brain icon
 * used elsewhere in the app (About, OrxRankHub, etc.). Rendered inside SVG
 * via foreignObject so the rest of the scene stays pure SVG.
 */
function BrainShape({ animate, shrink = false }: BrainShapeProps) {
  const SIZE = 630;
  const targetScale = shrink ? 0.5 : 1;
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

  if (!animate) {
    return <g transform={`scale(${targetScale})`}>{icon}</g>;
  }

  return (
    <motion.g
      animate={{ scale: shrink ? [targetScale, targetScale * 1.03, targetScale] : [1, 1.03, 1] }}
      transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
    >
      {icon}
    </motion.g>
  );
}
