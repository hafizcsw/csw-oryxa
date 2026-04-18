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
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import brainAnatomical from "@/assets/brain-anatomical.svg";
import AnomalyOrb from "@/components/orb/AnomalyOrb";
import { mapFileStatusesToBrainStage } from "@/utils/mapUploadPipelineToBrainStage";

export type AIDataFlowHeroFileStatus = "pending" | "active" | "done" | "failed";

export interface AIDataFlowHeroFile {
  name: string;
  /** Real backend processing status. Defaults to 'active' if omitted. */
  status?: AIDataFlowHeroFileStatus;
  /** Stable id used by onDelete */
  id?: string;
  /** Object URL or remote URL to a real preview thumbnail (image or PDF first-page) */
  previewUrl?: string;
  /** Multi-page preview URLs (e.g. one per PDF page). When present and > 1,
   *  the card cycles through them while `status === 'active'` to mimic a live scan. */
  previewUrls?: string[];
  /** MIME type (used to decide if previewUrl is renderable as image) */
  mimeType?: string;
  /** When set: this file failed reading or has weak/unknown quality.
   *  The connector wire turns red and a small summary banner floats above the card. */
  issue?: { reason: string } | null;
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
  /** Called when user clicks the delete button on a card */
  onDeleteFile?: (id: string) => void;
  /** Localized delete label */
  deleteLabel?: string;
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
  onDeleteFile,
  deleteLabel,
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

  // ───── Real-status driven scan state ─────
  // Each card's state comes DIRECTLY from the per-file status passed by the
  // parent (which mirrors the real backend processing_status). No timer.
  // - 'pending'  → not yet started / queued
  // - 'active'   → currently being uploaded / parsed (beam + chips + connectors)
  // - 'done'     → finished successfully (✓ green)
  // - 'failed'   → finished with error (treated visually like done; red optional)
  const fileStatuses: AIDataFlowHeroFileStatus[] = useMemo(
    () => fileList.map((f) => f.status ?? "active"),
    [fileList],
  );

  // Brain stays permanently at the compact size — no growing/shrinking.
  // Instead, the INTERIOR of the brain fills with technical circuitry as
  // each file finishes processing. While any file is active, the inner
  // circuits pulse continuously (energy flowing in from connectors).
  const anyInFlight = fileStatuses.some((s) => s === "pending" || s === "active");
  const allDone = totalDocs > 0 && !anyInFlight;
  const activeCount = fileStatuses.filter((s) => s === "active").length;
  const doneCount = fileStatuses.filter((s) => s === "done" || s === "failed").length;
  const fillProgress = totalDocs > 0 ? doneCount / totalDocs : 0; // 0..1
  const isEnergized = activeCount > 0;

  // Derive new brain pipeline state (stage + progress) from per-file statuses.
  const brainPipeline = useMemo(
    () => mapFileStatusesToBrainStage(fileStatuses, { isDragOver, isUploading: isProcessing }),
    [fileStatuses, isDragOver, isProcessing],
  );

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
      // Clean column alignment — no jitter, no rotation. Cards stack tidily.
      return { x: anchorX, y, rotate: 0, scale: 1, opacity: 1, index: i, gIdx: gIdxStart + i };
    });
  };

  // Reading order: left column top→bottom (gIdx 0..lc-1), then right column (gIdx lc..lc+rc-1)
  const leftCards = distributeColumn(lc, LEFT_X, false, 0);
  const rightCards = distributeColumn(rc, RIGHT_X, true, lc);

  // Card visual state comes straight from the real backend status.
  const cardState = (gIdx: number): "pending" | "active" | "done" => {
    const s = fileStatuses[gIdx];
    if (s === "done" || s === "failed") return "done";
    if (s === "active") return "active";
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

  // Tubes are PERSISTENT — once a file exists, its 3 cables stay rendered
  // for the whole session. Color/animation reflect the per-file status:
  //   active  → purple/cyan flowing energy
  //   done    → calm green steady glow
  //   failed  → red steady glow (with issue) or red flowing
  //   pending → dim foreground, no flow
  const tubeToneFor = (gIdx: number): "active" | "done" | "error" | "pending" => {
    if (fileList[gIdx]?.issue) return "error";
    const s = fileStatuses[gIdx];
    if (s === "failed") return "error";
    if (s === "done") return "done";
    if (s === "active") return "active";
    return "pending";
  };

  const activeConnectors = useMemo(
    () => connectors.filter((p) => fileStatuses[p.gIdx] === "active"),
    [connectors, fileStatuses],
  );

  const showConnectors = showDocuments && connectors.length > 0;
  const showChips = showDocuments && activeConnectors.length > 0;

  // Localized micro-labels with safe fallbacks
  const scanningLabel = (() => {
    const v = t("hero.aiFlow.scanning");
    return typeof v === "string" && v && v !== "hero.aiFlow.scanning" ? v : "Scanning…";
  })();
  const scannedLabel = (() => {
    const v = t("hero.aiFlow.scanned");
    return typeof v === "string" && v && v !== "hero.aiFlow.scanned" ? v : "Scanned";
  })();
  const resolvedDeleteLabel = (() => {
    if (deleteLabel) return deleteLabel;
    const v = t("common.delete");
    return typeof v === "string" && v && v !== "common.delete" ? v : "Delete";
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

          {/* Arrowhead marker — red variant for failed/weak files */}
          <marker
            id={`${ids.arrowHead}-err`}
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" fill="hsl(var(--destructive))" fillOpacity="0.9" />
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

        {/* ═══ Connector tubes — glowing 3-cable pipeline for the active file ═══ */}
        {showConnectors && (
          <g fill="none" strokeLinecap="round">
            {activeConnectors.map((p) => (
              <ConnectorTube
                key={`act-${p.key}`}
                d={p.d}
                animate={!reduceMotion}
                delay={0.15 + p.lineIdx * 0.08}
                markerId={ids.arrowHead}
                tone="active"
              />
            ))}
          </g>
        )}

        {/* ═══ Mid-flight extraction chips — ONLY on active file's lines ═══ */}
        {showChips && !reduceMotion && (
          <g>
            {activeConnectors.map((p, i) => (
              <DocumentChip
                key={`chip-${p.key}`}
                pathD={p.d}
                duration={cfg.chipDuration}
                delay={(0.5 + p.lineIdx * 0.5 + (i * 0.15)) % cfg.chipDuration}
              />
            ))}
          </g>
        )}


        {/* ═══ Issue connector tubes — RED cable look, for failed/weak files ═══ */}
        {showDocuments && issuedConnectors.length > 0 && (
          <g fill="none" strokeLinecap="round">
            {issuedConnectors.map((p) => (
              <ConnectorTube
                key={`err-${p.key}`}
                d={p.d}
                animate={!reduceMotion}
                delay={0.1 + p.lineIdx * 0.06}
                markerId={`${ids.arrowHead}-err`}
                tone="error"
              />
            ))}
          </g>
        )}

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
                  previewUrl={fileList[c.gIdx]?.previewUrl}
                  previewUrls={fileList[c.gIdx]?.previewUrls}
                  mimeType={fileList[c.gIdx]?.mimeType}
                  fileId={fileList[c.gIdx]?.id}
                  onDelete={onDeleteFile}
                  deleteLabel={resolvedDeleteLabel}
                  state={st}
                  scanDurationSec={SCAN_DURATION_MS / 1000}
                  scanningLabel={scanningLabel}
                  scannedLabel={scannedLabel}
                  issue={fileList[c.gIdx]?.issue ?? null}
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
                  previewUrl={fileList[c.gIdx]?.previewUrl}
                  previewUrls={fileList[c.gIdx]?.previewUrls}
                  mimeType={fileList[c.gIdx]?.mimeType}
                  fileId={fileList[c.gIdx]?.id}
                  onDelete={onDeleteFile}
                  deleteLabel={resolvedDeleteLabel}
                  state={st}
                  scanDurationSec={SCAN_DURATION_MS / 1000}
                  scanningLabel={scanningLabel}
                  scannedLabel={scannedLabel}
                  issue={fileList[c.gIdx]?.issue ?? null}
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

        {/* ═══ Anomaly Orb (Three.js + GLSL) ═══
            All real props are wired to file-analysis activity:
              • audioLevel  → analysis intensity (drives shader displacement + scale)
              • distortion  → grows as more files are processed
              • pulseSpeed  → faster while extracting/interpreting
              • customColors → lerp from dim palette → vivid palette as progress grows
                              (red palette in error state) */}
        <foreignObject x={CX - 220} y={CY - 220} width={440} height={440}>
          <div className="w-full h-full flex items-center justify-center">
            <AnomalyOrb
              size={420}
              audioLevel={(() => {
                // Map stage → an "energy level" 0..1 that drives shader uniforms.
                const t = brainPipeline.progress / 100;
                if (brainPipeline.stage === "idle") return 0.05;
                if (brainPipeline.stage === "complete") return 0.25;
                if (brainPipeline.stage === "error") return 0.15;
                // Active stages: combine progress + a per-stage floor.
                const floor =
                  brainPipeline.stage === "uploading" ? 0.2
                  : brainPipeline.stage === "scanning" ? 0.4
                  : brainPipeline.stage === "extracting" ? 0.6
                  : 0.75; // interpreting
                return Math.min(1, floor + t * 0.25);
              })()}
              distortion={
                brainPipeline.stage === "idle"
                  ? 0.3
                  : 0.4 + (brainPipeline.progress / 100) * 0.5
              }
              pulseSpeed={
                brainPipeline.stage === "idle"
                  ? 0.6
                  : brainPipeline.stage === "complete"
                    ? 1.2
                    : 0.8 + (brainPipeline.progress / 100) * 1.0
              }
              customColors={(() => {
                const t = brainPipeline.progress / 100;
                const lerpHex = (a: string, b: string, k: number) => {
                  const ah = parseInt(a.slice(1), 16);
                  const bh = parseInt(b.slice(1), 16);
                  const ar = (ah >> 16) & 255, ag = (ah >> 8) & 255, ab = ah & 255;
                  const br = (bh >> 16) & 255, bg = (bh >> 8) & 255, bb = bh & 255;
                  const r = Math.round(ar + (br - ar) * k);
                  const g = Math.round(ag + (bg - ag) * k);
                  const bl = Math.round(ab + (bb - ab) * k);
                  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
                };
                const dim = { c1: "#2a3a4a", c2: "#3a3a5a", c3: "#2a4a6a" };
                const vivid =
                  brainPipeline.stage === "error"
                    ? { c1: "#ff6b6b", c2: "#c92a2a", c3: "#ff8787" }
                    : { c1: "#00ffff", c2: "#8b5cf6", c3: "#0ea5e9" };
                return {
                  color1: lerpHex(dim.c1, vivid.c1, t),
                  color2: lerpHex(dim.c2, vivid.c2, t),
                  color3: lerpHex(dim.c3, vivid.c3, t),
                };
              })()}
            />
          </div>
        </foreignObject>
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
  /** Real preview thumbnail URL (image/* or generated PDF preview) */
  previewUrl?: string;
  /** Multi-page preview URLs — when length > 1 the card cycles through them
   *  during the active scan so the user sees pages flip live. */
  previewUrls?: string[];
  /** MIME type for the file behind previewUrl */
  mimeType?: string;
  /** Stable id passed back via onDelete */
  fileId?: string;
  /** Click-to-delete handler */
  onDelete?: (id: string) => void;
  /** Localized delete aria-label */
  deleteLabel?: string;
  /** When set, render a small red banner above the card with the issue reason */
  issue?: { reason: string } | null;
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
  previewUrl,
  previewUrls,
  mimeType,
  fileId,
  onDelete,
  deleteLabel = "Delete",
  issue = null,
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

  // Treat as image-preview when a real thumbnail exists. Multi-page PDF
  // previews count as image preview because each page IS a rendered image.
  const hasMultiPage = !!previewUrls && previewUrls.length > 1;
  const effectivePreviewUrls: string[] =
    hasMultiPage
      ? (previewUrls as string[])
      : previewUrl
        ? [previewUrl]
        : [];
  const isImagePreview =
    effectivePreviewUrls.length > 0 &&
    (hasMultiPage ||
      mimeType?.startsWith("image/") ||
      mimeType === "application/pdf" ||
      /\.(png|jpe?g|webp|gif|svg|pdf)$/i.test(label));

  // ── Live page cycling: while ACTIVE, flip through pages every ~1.4s.
  //    Stops on the last viewed page when state becomes 'done'.
  const [pageIdx, setPageIdx] = useState(0);
  useEffect(() => {
    if (!isActive || effectivePreviewUrls.length <= 1) return;
    const id = setInterval(() => {
      setPageIdx((p) => (p + 1) % effectivePreviewUrls.length);
    }, 1400);
    return () => clearInterval(id);
  }, [isActive, effectivePreviewUrls.length]);
  // Reset to page 0 when file changes (different number of pages)
  useEffect(() => {
    setPageIdx(0);
  }, [effectivePreviewUrls.length, fileId]);
  const currentPageUrl =
    effectivePreviewUrls[Math.min(pageIdx, effectivePreviewUrls.length - 1)] ||
    previewUrl;

  const previewClipId = `prev-clip-${shadowId}-${x}-${y}`;
  const gridClipId = `ocr-grid-clip-${shadowId}-${x}-${y}`;
  // Body region under the title strip — image gets nearly the full card
  const PREVIEW_X = 4;
  const PREVIEW_Y = 30;
  const PREVIEW_W = W - 8;
  const PREVIEW_H = H - 34;

  const sheet = (
    <g filter={`url(#${shadowId})`} opacity={bodyOpacity}>
      {/* Page background — neutral so letterboxing around the image is clean */}
      <rect
        width={W}
        height={H}
        rx={6}
        fill={isImagePreview ? "hsl(var(--muted))" : "hsl(var(--card))"}
        stroke={isDone ? "hsl(142 70% 42%)" : "hsl(var(--foreground))"}
        strokeOpacity={isDone ? 0.7 : 0.55}
        strokeWidth={1.1}
      />
      {/* Real preview image — fits the body fully, preserves real aspect ratio.
          For multi-page PDFs we swap `href` between rendered pages so the
          user sees the live page being scanned. */}
      {isImagePreview && currentPageUrl && (
        <g>
          <defs>
            <clipPath id={previewClipId}>
              <rect
                x={PREVIEW_X}
                y={PREVIEW_Y}
                width={PREVIEW_W}
                height={PREVIEW_H}
                rx={3}
              />
            </clipPath>
          </defs>
          <image
            href={currentPageUrl}
            x={PREVIEW_X}
            y={PREVIEW_Y}
            width={PREVIEW_W}
            height={PREVIEW_H}
            preserveAspectRatio="xMidYMid meet"
            clipPath={`url(#${previewClipId})`}
          />

          {/* ─── Live OCR grid overlay (only while actively scanning) ─── */}
          {isActive && float && (
            <g clipPath={`url(#${previewClipId})`} pointerEvents="none">
              {/* Horizontal grid lines sweeping vertically */}
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.line
                  key={`hg-${i}`}
                  x1={PREVIEW_X}
                  x2={PREVIEW_X + PREVIEW_W}
                  stroke="hsl(265 95% 70%)"
                  strokeOpacity={0.55}
                  strokeWidth={0.6}
                  initial={{ y1: PREVIEW_Y, y2: PREVIEW_Y }}
                  animate={{
                    y1: [PREVIEW_Y, PREVIEW_Y + PREVIEW_H],
                    y2: [PREVIEW_Y, PREVIEW_Y + PREVIEW_H],
                  }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    ease: "linear",
                    delay: (i * 2.4) / 6,
                  }}
                />
              ))}
              {/* Vertical grid lines sweeping horizontally */}
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.line
                  key={`vg-${i}`}
                  y1={PREVIEW_Y}
                  y2={PREVIEW_Y + PREVIEW_H}
                  stroke="hsl(200 95% 65%)"
                  strokeOpacity={0.4}
                  strokeWidth={0.5}
                  initial={{ x1: PREVIEW_X, x2: PREVIEW_X }}
                  animate={{
                    x1: [PREVIEW_X, PREVIEW_X + PREVIEW_W],
                    x2: [PREVIEW_X, PREVIEW_X + PREVIEW_W],
                  }}
                  transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    ease: "linear",
                    delay: (i * 3.2) / 5,
                  }}
                />
              ))}
              {/* Detection dots that pop along a moving scan line */}
              {Array.from({ length: 8 }).map((_, i) => {
                const cx = PREVIEW_X + ((i * 37) % (PREVIEW_W - 10)) + 5;
                const cy = PREVIEW_Y + ((i * 53) % (PREVIEW_H - 10)) + 5;
                return (
                  <motion.circle
                    key={`dot-${i}`}
                    cx={cx}
                    cy={cy}
                    r={1.6}
                    fill="hsl(265 95% 75%)"
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{ opacity: [0, 1, 0], scale: [0.3, 1.4, 0.3] }}
                    transition={{
                      duration: 1.6,
                      repeat: Infinity,
                      delay: (i * 0.18) % 1.6,
                      ease: "easeOut",
                    }}
                  />
                );
              })}
              {/* Page indicator dot strip — shows which page is currently scanned */}
              {hasMultiPage && (
                <g transform={`translate(${PREVIEW_X + PREVIEW_W / 2 - (effectivePreviewUrls.length * 5) / 2}, ${PREVIEW_Y + PREVIEW_H - 8})`}>
                  <rect
                    x={-4}
                    y={-3}
                    width={effectivePreviewUrls.length * 5 + 8}
                    height={8}
                    rx={3}
                    fill="hsl(var(--background))"
                    fillOpacity={0.7}
                  />
                  {effectivePreviewUrls.map((_, i) => (
                    <circle
                      key={`pi-${i}`}
                      cx={i * 5 + 2}
                      cy={1}
                      r={1.4}
                      fill={i === pageIdx ? "hsl(265 95% 60%)" : "hsl(var(--muted-foreground))"}
                      fillOpacity={i === pageIdx ? 1 : 0.5}
                    />
                  ))}
                </g>
              )}
            </g>
          )}
        </g>
      )}
      {/* Folded corner — hidden when a real preview is rendered */}
      {!isImagePreview && (
        <path
          d={mirrored
            ? `M 0 0 L 18 0 L 0 18 Z`
            : `M ${W} 0 L ${W - 18} 0 L ${W} 18 Z`}
          fill="hsl(var(--muted))"
        />
      )}
      {/* Filename strip — replaces generic header block. Text is clipped to
          the strip so long / RTL filenames never overflow the card. */}
      <g>
        <defs>
          <clipPath id={`title-clip-${shadowId}-${x}-${y}`}>
            <rect x={10} y={9} width={W - 20} height={18} rx={3} />
          </clipPath>
        </defs>
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
          direction="ltr"
          clipPath={`url(#title-clip-${shadowId}-${x}-${y})`}
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", direction: "ltr", unicodeBidi: "plaintext" }}
        >
          {truncateName(label, 14)}
        </text>
      </g>

      {/* State micro-label under filename */}
      {(isActive || isDone) && (
        <g>
          {isActive && float ? (
            <motion.circle
              cx={mirrored ? 16 : W - 16}
              cy={40}
              r={3}
              fill="hsl(265 90% 60%)"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: `${mirrored ? 16 : W - 16}px 40px` }}
            />
          ) : isDone ? (
            <g transform={`translate(${mirrored ? 10 : W - 22}, 33)`}>
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
          {!isImagePreview && (
            <text
              x={mirrored ? W - 32 : 32}
              y={47}
              textAnchor={mirrored ? "end" : "start"}
              fontSize={7}
              fill={isDone ? "hsl(142 70% 35%)" : "hsl(265 85% 55%)"}
              fontWeight={600}
              style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
            >
              {isDone ? scannedLabel : scanningLabel}
            </text>
          )}
        </g>
      )}

      {/* Body lines / footer / emphasis — only when no real preview */}
      {!isImagePreview && (
        <>
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
          <rect
            x={mirrored ? W - 64 : 38}
            y={H * 0.62}
            width={42}
            height={10}
            rx={1.5}
            fill={isDone ? "hsl(142 70% 42%)" : "hsl(var(--foreground))"}
            fillOpacity={isDone ? 0.7 : 0.82}
          />
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
        </>
      )}
      {/* Card border on top of preview */}
      {isImagePreview && (
        <rect
          width={W}
          height={H}
          rx={6}
          fill="none"
          stroke={isDone ? "hsl(142 70% 42%)" : "hsl(var(--foreground))"}
          strokeOpacity={isDone ? 0.7 : 0.55}
          strokeWidth={1.1}
          pointerEvents="none"
        />
      )}
      {/* Live scan beam — ONLY while this card is being actively scanned. */}
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
      {/* Delete button — sits above the card */}
      {onDelete && fileId && (
        <g
          transform={`translate(${W - 12}, -10)`}
          style={{ cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(fileId);
          }}
          role="button"
          aria-label={deleteLabel}
        >
          <title>{deleteLabel}</title>
          <circle r={11} fill="hsl(var(--destructive))" stroke="hsl(var(--background))" strokeWidth={1.5} />
          <path
            d="M -4 -4 L 4 4 M 4 -4 L -4 4"
            stroke="hsl(var(--destructive-foreground))"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Issue banner — small floating summary above the card explaining
          why the engine could not understand this file. Rendered as
          foreignObject so it can use real (RTL-safe) text + wrap. */}
      {issue && (
        <g pointerEvents="none">
          {/* connector dot from banner to card top */}
          <circle cx={W / 2} cy={-4} r={2.5} fill="hsl(var(--destructive))" />
          <foreignObject
            x={-12}
            y={-46}
            width={W + 24}
            height={42}
            style={{ overflow: "visible" }}
          >
            <div
              style={{
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                fontSize: "10px",
                lineHeight: 1.25,
                fontWeight: 600,
                color: "hsl(var(--destructive-foreground))",
                background: "hsl(var(--destructive))",
                padding: "4px 6px",
                borderRadius: "6px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
                textAlign: "center",
                wordBreak: "break-word",
              }}
            >
              {issue.reason}
            </div>
          </foreignObject>
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

interface ConnectorTubeProps {
  d: string;
  animate: boolean;
  delay: number;
  markerId: string;
  tone: "active" | "error";
}

/**
 * Renders a single connector as a glowing cable/tube:
 *   - outer casing (thick, soft) → physical "pipe"
 *   - inner core (thin, bright) → conductor
 *   - flowing energy dashes → live data transfer
 * Combined with the 3 lines per card, this reads as 3 illuminated tubes.
 */
function ConnectorTube({ d, animate, delay, markerId, tone }: ConnectorTubeProps) {
  const isError = tone === "error";
  const casingStroke = isError ? "hsl(var(--destructive))" : "hsl(var(--foreground))";
  const coreStroke = isError ? "hsl(var(--destructive))" : "hsl(265 95% 78%)";
  const flowStroke = isError ? "hsl(var(--destructive))" : "hsl(190 100% 80%)";

  const casing = (
    <path
      d={d}
      stroke={casingStroke}
      strokeOpacity={isError ? 0.45 : 0.32}
      strokeWidth={5}
      fill="none"
      strokeLinecap="round"
    />
  );

  const core = (
    <path
      d={d}
      stroke={coreStroke}
      strokeOpacity={isError ? 0.9 : 0.85}
      strokeWidth={1.6}
      fill="none"
      strokeLinecap="round"
      markerEnd={`url(#${markerId})`}
    />
  );

  if (!animate) {
    return (
      <g>
        {casing}
        {core}
      </g>
    );
  }

  return (
    <g>
      {casing}
      <motion.path
        d={d}
        stroke={coreStroke}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: isError ? 0.9 : 0.85 }}
        transition={{
          pathLength: { duration: 1.2, delay, ease: "easeInOut" },
          opacity: { duration: 0.4, delay },
        }}
      />
      {/* Flowing energy pulse inside the tube */}
      <motion.path
        d={d}
        stroke={flowStroke}
        strokeOpacity={0.95}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
        strokeDasharray="6 22"
        initial={{ strokeDashoffset: 0, opacity: 0 }}
        animate={{ strokeDashoffset: -560, opacity: [0, 1, 1, 1] }}
        transition={{
          strokeDashoffset: { duration: isError ? 2.6 : 1.6, delay: delay + 0.4, repeat: Infinity, ease: "linear" },
          opacity: { duration: 0.6, delay: delay + 0.4 },
        }}
        style={{ filter: "blur(0.4px)" }}
      />
    </g>
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
  /** 0..1 — share of files that have finished processing */
  fillProgress?: number;
  /** true while at least one file is actively being parsed */
  isEnergized?: boolean;
  /** true once every file has reached a terminal status */
  allDone?: boolean;
  /** Names of currently-active files — drives ingestion ripples per lobe. */
  activeFileNames?: string[];
}

/** Map a filename to a brain lobe ingestion target (in tech-layer coords). */
function lobeForFileName(name: string): { x: number; y: number; key: string } {
  const n = (name || "").toLowerCase();
  // Keyword routing → distinct lobes
  if (/(passport|جواز|بطاقة|id|national)/.test(n)) return { x: -52, y: -28, key: "frontal-l" };
  if (/(grad|شهادة|diploma|degree|تخرج|بكالوريوس)/.test(n)) return { x: 0, y: -56, key: "parietal" };
  if (/(transcript|كشف|درجات|grades|marks)/.test(n)) return { x: 56, y: -10, key: "temporal-r" };
  if (/(ielts|toefl|english|عربي|language|لغة|سات)/.test(n)) return { x: -56, y: 28, key: "broca" };
  if (/(cv|resume|سيرة)/.test(n)) return { x: 50, y: 32, key: "occipital-r" };
  if (/(photo|صورة|image|picture)/.test(n)) return { x: -28, y: 50, key: "cerebellum-l" };
  // Fallback: hash to one of 6 stable targets
  const targets = [
    { x: -52, y: -28, key: "frontal-l" },
    { x: 0, y: -56, key: "parietal" },
    { x: 56, y: -10, key: "temporal-r" },
    { x: -56, y: 28, key: "broca" },
    { x: 50, y: 32, key: "occipital-r" },
    { x: -28, y: 50, key: "cerebellum-l" },
  ];
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0;
  return targets[Math.abs(h) % targets.length];
}

/**
 * Brain-centered metaphor — locked at the compact size. The interior fills
 * with a stylized circuit / chip / binary-rain layer that grows as files
 * finish processing. While energized, the inner layer pulses; when all
 * files are done, the layer holds steady at full glow.
 */
function BrainShape({
  animate,
  fillProgress = 0,
  isEnergized = false,
  allDone = false,
  activeFileNames = [],
}: BrainShapeProps) {
  const SIZE = 630;
  // Brain is permanently rendered at compact scale — no resize behavior.
  const SCALE = 0.5;

  // Inner-tech canvas dimensions (in BRAIN-LOCAL coords AFTER the SCALE group).
  // We draw the tech overlay in a small 200x160 box centered on (0,0) so it
  // visually sits inside the brain silhouette regardless of icon stroke detail.
  const TW = 200;
  const TH = 160;
  const clipId = useId().replace(/:/g, "");

  // Approximate brain silhouette path (two-hemisphere blob), used as clipPath
  // so all inner tech elements are masked to the brain shape.
  // Coordinates assume a 200x160 box centered around (0,0).
  const BRAIN_CLIP_D =
    "M -90 -10 " +
    "C -100 -50, -60 -78, -20 -70 " +
    "C -10 -82, 10 -82, 20 -70 " +
    "C 60 -78, 100 -50, 90 -10 " +
    "C 100 30, 70 70, 20 68 " +
    "C 10 78, -10 78, -20 68 " +
    "C -70 70, -100 30, -90 -10 Z";

  // ─────────────────────────────────────────────────────────────
  // Reference: a glowing AI chip sits at the brain's center with
  // circuit traces fanning OUTWARD from each chip pin into the
  // surrounding brain tissue (PCB-style right-angle traces).
  // ─────────────────────────────────────────────────────────────

  // Central chip geometry
  const CHIP_W = 44;
  const CHIP_H = 32;
  const CHIP_X = -CHIP_W / 2;
  const CHIP_Y = -CHIP_H / 2;

  // Pin positions on each side of the chip + the trace each pin extends.
  // Traces use right-angle PCB routing and end at synapse nodes near the
  // brain perimeter. Each is revealed progressively with fillProgress.
  type Trace = { pin: { x: number; y: number }; d: string; node: { x: number; y: number } };
  const TRACES: Trace[] = [
    // Top pins → upper hemisphere
    { pin: { x: -14, y: -16 }, d: "M -14 -16 L -14 -34 L -40 -34 L -40 -52", node: { x: -40, y: -52 } },
    { pin: { x:  -4, y: -16 }, d: "M -4 -16 L -4 -42 L -22 -42 L -22 -60",   node: { x: -22, y: -60 } },
    { pin: { x:   4, y: -16 }, d: "M 4 -16 L 4 -42 L 22 -42 L 22 -60",       node: { x:  22, y: -60 } },
    { pin: { x:  14, y: -16 }, d: "M 14 -16 L 14 -34 L 40 -34 L 40 -52",     node: { x:  40, y: -52 } },
    // Bottom pins → lower hemisphere
    { pin: { x: -14, y:  16 }, d: "M -14 16 L -14 36 L -34 36 L -34 56",     node: { x: -34, y:  56 } },
    { pin: { x:  -4, y:  16 }, d: "M -4 16 L -4 44 L -16 44 L -16 64",       node: { x: -16, y:  64 } },
    { pin: { x:   4, y:  16 }, d: "M 4 16 L 4 44 L 16 44 L 16 64",           node: { x:  16, y:  64 } },
    { pin: { x:  14, y:  16 }, d: "M 14 16 L 14 36 L 34 36 L 34 56",         node: { x:  34, y:  56 } },
    // Left pins → left hemisphere
    { pin: { x: -22, y:  -8 }, d: "M -22 -8 L -44 -8 L -44 -22 L -68 -22",   node: { x: -68, y: -22 } },
    { pin: { x: -22, y:   8 }, d: "M -22 8 L -44 8 L -44 22 L -68 22",       node: { x: -68, y:  22 } },
    // Right pins → right hemisphere
    { pin: { x:  22, y:  -8 }, d: "M 22 -8 L 44 -8 L 44 -22 L 68 -22",       node: { x:  68, y: -22 } },
    { pin: { x:  22, y:   8 }, d: "M 22 8 L 44 8 L 44 22 L 68 22",           node: { x:  68, y:  22 } },
  ];
  const totalTraces = TRACES.length;

  // Binary rain — vertical streams of 1/0 chars in the background.
  const rainColumns = [-70, -45, 45, 70];

  // Chip glow scales with progress; minimum visible from the start so the
  // chip is always the visual anchor of the brain.
  const chipGlow = 0.55 + 0.45 * fillProgress;
  const traceBase = 0.25 + 0.55 * fillProgress;

  const techLayer = (
    <g>
      <defs>
        <clipPath id={`brain-tech-clip-${clipId}`}>
          <path d={BRAIN_CLIP_D} />
        </clipPath>
        {/* Cyan radial halo behind the chip */}
        <radialGradient id={`brain-core-${clipId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(190 100% 80%)" stopOpacity="0.95" />
          <stop offset="45%" stopColor="hsl(200 100% 60%)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="hsl(220 95% 55%)" stopOpacity="0" />
        </radialGradient>
        {/* Chip face gradient — bright cyan/blue like the reference */}
        <linearGradient id={`chip-face-${clipId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(195 100% 60%)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="hsl(220 100% 45%)" stopOpacity="0.95" />
        </linearGradient>
        {/* Soft glow filter for the chip */}
        <filter id={`chip-glow-${clipId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g clipPath={`url(#brain-tech-clip-${clipId})`}>
        {/* Soft cyan halo intensifies with progress + active energy */}
        <circle
          cx={0}
          cy={0}
          r={95}
          fill={`url(#brain-core-${clipId})`}
          opacity={0.35 + 0.5 * fillProgress + (isEnergized ? 0.15 : 0)}
        />

        {/* Background binary rain — only flows while energized */}
        {animate && isEnergized && (
          <g
            fontFamily="ui-monospace, SFMono-Regular, monospace"
            fontSize={4.5}
            fill="hsl(190 95% 75%)"
            opacity={0.28}
          >
            {rainColumns.map((cx, ci) => (
              <motion.g
                key={`rain-${ci}`}
                animate={{ y: [-70, 70] }}
                transition={{
                  duration: 2.6 + (ci % 3) * 0.5,
                  repeat: Infinity,
                  ease: "linear",
                  delay: (ci * 0.4) % 1.8,
                }}
              >
                {[0, 9, 18, 27, 36, 45, 54, 63, 72].map((dy, di) => (
                  <text key={`r-${ci}-${di}`} x={cx} y={-72 + dy} textAnchor="middle">
                    {(ci + di) % 2 === 0 ? "1" : "0"}
                  </text>
                ))}
              </motion.g>
            ))}
          </g>
        )}

        {/* Circuit traces fanning OUT from chip pins (PCB-style) */}
        <g
          stroke="hsl(190 100% 72%)"
          strokeWidth={0.9}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="miter"
        >
          {TRACES.map((tr, i) => {
            const threshold = i / totalTraces;
            const revealed = fillProgress >= threshold;
            const op = revealed ? traceBase + 0.35 : 0.12;
            if (animate && isEnergized && revealed) {
              return (
                <motion.path
                  key={`tr-${i}`}
                  d={tr.d}
                  opacity={op}
                  animate={{ opacity: [op, op + 0.35, op] }}
                  transition={{
                    duration: 1.6 + (i % 4) * 0.3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: (i * 0.1) % 1.4,
                  }}
                />
              );
            }
            return <path key={`tr-${i}`} d={tr.d} opacity={op} />;
          })}
        </g>

        {/* Synapse end-nodes at trace tips */}
        <g>
          {TRACES.map((tr, i) => {
            const threshold = i / totalTraces;
            const lit = fillProgress >= threshold;
            const op = lit ? 0.95 : 0.18;
            if (animate && isEnergized && lit) {
              return (
                <motion.circle
                  key={`nd-${i}`}
                  cx={tr.node.x}
                  cy={tr.node.y}
                  r={2}
                  fill="hsl(190 100% 85%)"
                  animate={{ opacity: [op, 1, op], r: [1.8, 2.6, 1.8] }}
                  transition={{
                    duration: 1.4 + (i % 3) * 0.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: (i * 0.15) % 1.2,
                  }}
                  style={{ transformOrigin: `${tr.node.x}px ${tr.node.y}px` }}
                />
              );
            }
            return (
              <circle
                key={`nd-${i}`}
                cx={tr.node.x}
                cy={tr.node.y}
                r={1.8}
                fill="hsl(190 100% 85%)"
                opacity={op}
              />
            );
          })}
        </g>

        {/* Per-file ingestion ripples — each active file pings its lobe */}
        {animate &&
          activeFileNames.map((fname, i) => {
            const lobe = lobeForFileName(fname);
            const delay = (i * 0.35) % 1.4;
            return (
              <g key={`ing-${i}-${lobe.key}`}>
                {/* Outer ripple */}
                <motion.circle
                  cx={lobe.x}
                  cy={lobe.y}
                  r={4}
                  fill="none"
                  stroke="hsl(190 100% 75%)"
                  strokeWidth={0.9}
                  initial={{ opacity: 0 }}
                  animate={{ r: [4, 22, 4], opacity: [0.85, 0, 0.85] }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    ease: "easeOut",
                    delay,
                  }}
                  style={{ transformOrigin: `${lobe.x}px ${lobe.y}px` }}
                />
                {/* Inner hot core */}
                <motion.circle
                  cx={lobe.x}
                  cy={lobe.y}
                  r={2.4}
                  fill="hsl(190 100% 88%)"
                  animate={{ opacity: [0.6, 1, 0.6], r: [2, 3.2, 2] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay,
                  }}
                  style={{ transformOrigin: `${lobe.x}px ${lobe.y}px` }}
                />
                {/* Faint connecting trace from chip → lobe (data path) */}
                <motion.line
                  x1={0}
                  y1={0}
                  x2={lobe.x}
                  y2={lobe.y}
                  stroke="hsl(195 100% 80%)"
                  strokeWidth={0.6}
                  strokeDasharray="2 3"
                  animate={{ strokeDashoffset: [0, -10], opacity: [0.25, 0.6, 0.25] }}
                  transition={{
                    strokeDashoffset: { duration: 1.4, repeat: Infinity, ease: "linear", delay },
                    opacity: { duration: 1.4, repeat: Infinity, ease: "easeInOut", delay },
                  }}
                />
              </g>
            );
          })}

        {/* Central AI chip — visual anchor (matches reference video) */}
        <g opacity={chipGlow} filter={`url(#chip-glow-${clipId})`}>
          {/* Pin stubs on every edge */}
          <g stroke="hsl(190 100% 75%)" strokeWidth={1}>
            {[-14, -4, 4, 14].map((px) => (
              <g key={`pt-${px}`}>
                <line x1={px} y1={-CHIP_H / 2} x2={px} y2={-CHIP_H / 2 - 4} />
                <line x1={px} y1={CHIP_H / 2}  x2={px} y2={CHIP_H / 2 + 4} />
              </g>
            ))}
            {[-8, 8].map((py) => (
              <g key={`pl-${py}`}>
                <line x1={-CHIP_W / 2} y1={py} x2={-CHIP_W / 2 - 4} y2={py} />
                <line x1={CHIP_W / 2}  y1={py} x2={CHIP_W / 2 + 4}  y2={py} />
              </g>
            ))}
          </g>

          {/* Chip body */}
          <rect
            x={CHIP_X}
            y={CHIP_Y}
            width={CHIP_W}
            height={CHIP_H}
            rx={4}
            fill={`url(#chip-face-${clipId})`}
            stroke="hsl(190 100% 85%)"
            strokeWidth={1}
          />
          {/* Inner bevel */}
          <rect
            x={CHIP_X + 2.5}
            y={CHIP_Y + 2.5}
            width={CHIP_W - 5}
            height={CHIP_H - 5}
            rx={2.5}
            fill="none"
            stroke="hsl(195 100% 88%)"
            strokeOpacity={0.55}
            strokeWidth={0.6}
          />
          {/* "AI" label */}
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fontSize={14}
            fontWeight={800}
            fill="hsl(0 0% 100%)"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            style={{ letterSpacing: "0.5px" }}
          >
            AI
          </text>

          {animate && isEnergized && (
            <motion.rect
              x={CHIP_X - 2}
              y={CHIP_Y - 2}
              width={CHIP_W + 4}
              height={CHIP_H + 4}
              rx={5}
              fill="none"
              stroke="hsl(190 100% 85%)"
              strokeWidth={0.9}
              animate={{ opacity: [0.25, 0.95, 0.25] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          {allDone && (
            <motion.rect
              x={CHIP_X - 4}
              y={CHIP_Y - 4}
              width={CHIP_W + 8}
              height={CHIP_H + 8}
              rx={6}
              fill="none"
              stroke="hsl(142 70% 55%)"
              strokeWidth={0.8}
              animate={{ opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </g>
      </g>
    </g>
  );

  const icon = (
    <image
      href={brainAnatomical}
      x={-SIZE / 2}
      y={-SIZE / 2}
      width={SIZE}
      height={SIZE}
      preserveAspectRatio="xMidYMid meet"
      style={{
        filter:
          "drop-shadow(0 0 8px hsl(200 100% 70% / 0.45)) drop-shadow(0 0 22px hsl(220 100% 60% / 0.25))",
      }}
    />
  );

  const content = (
    <>
      {icon}
      {techLayer}
    </>
  );

  if (!animate) {
    return <g transform={`scale(${SCALE})`}>{content}</g>;
  }

  return (
    <motion.g
      transform={`scale(${SCALE})`}
      animate={{ scale: [SCALE, SCALE * 1.03, SCALE] }}
      transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
    >
      {content}
    </motion.g>
  );
}
