// ═══════════════════════════════════════════════════════════════
// BrainIngestionVisualizer — STRUCTURE-BASED inline SVG.
//
// NO raster <image> assets. NO global filter wash.
// All layers are real vector paths/circles, animated via CSS
// (stroke-dashoffset, opacity transitions) and per-region opacity.
//
// Layer model (matches spec):
//   1. Brain silhouette + internal wireframe (always crisp, dominant)
//   2. Passive branch skeleton
//   3. Active branch streams (animated dashes)
//   4. Branch nodes (sequential pulse)
//   5. Entry bridges (terminal → silhouette perimeter)
//   6. Region fills (segmented, clipped to silhouette)
//   7. Completion aura (minimal, end-only)
//   8. File node glyphs
// ═══════════════════════════════════════════════════════════════

import { memo, useId } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBrainIngestionAnimation } from "./useBrainIngestionAnimation";
import type { BrainIngestionVisualizerProps } from "./BrainIngestionVisualizer.types";
import {
  VB_W,
  VB_H,
  CX,
  CY,
  BRAIN_SILHOUETTE_D,
  BRAIN_SEAM_D,
  BRAIN_WIREFRAME_LEFT,
  BRAIN_WIREFRAME_RIGHT,
  REGION_PATHS,
  REGION_ORDER,
  BRANCHES,
  BRANCH_NODES,
  ENTRY_BRIDGES,
  FILE_LEFT,
  FILE_RIGHT,
} from "./brainGeometry";
import "./brain-ingestion.css";

function BrainIngestionVisualizerComponent({
  stage,
  progress = 0,
  showFileNode = true,
  fileLabel,
  animate = true,
  reducedMotion,
  className,
  ariaLabel,
}: BrainIngestionVisualizerProps) {
  const prefersReduce = useReducedMotion();
  const reduced = reducedMotion ?? !!prefersReduce;
  const motionOff = !animate || reduced;

  const m = useBrainIngestionAnimation(stage, progress);
  const uid = useId().replace(/:/g, "");
  const ids = {
    silhouetteClip: `biv-clip-${uid}`,
    aura: `biv-aura-${uid}`,
    glow: `biv-glow-${uid}`,
  };

  const styleVars = {
    ["--biv-branch-activation" as string]: m.branchActivation,
    ["--biv-stream-intensity" as string]: m.streamIntensity,
    ["--biv-bridge-activation" as string]: m.bridgeActivation,
    ["--biv-brain-fill" as string]: m.brainFill,
    ["--biv-stable-glow" as string]: m.stableGlow,
    ["--biv-error-dampening" as string]: m.errorDampening,
  } as React.CSSProperties;

  // Tier opacity: outer reveals first, then mid, then terminal.
  const tierOpacity = (tier: "outer" | "mid" | "terminal"): number => {
    const a = m.branchActivation;
    if (tier === "outer") return Math.min(1, a * 1.6);
    if (tier === "mid") return Math.min(1, Math.max(0, a - 0.2) * 1.6);
    return Math.min(1, Math.max(0, a - 0.45) * 1.8);
  };

  // Region color class — alternates cool/warm for visual rhythm.
  const regionClass = (id: string): string => {
    if (id === "core-seam") return "biv-region biv-region--seam";
    if (id.includes("upper")) return "biv-region biv-region--warm";
    return "biv-region biv-region--cool";
  };

  return (
    <div
      className={cn("biv-root relative", className)}
      data-stage={stage}
      data-progress={Math.round(progress)}
      data-reduced-motion={motionOff ? "true" : "false"}
      style={styleVars}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        xmlns="http://www.w3.org/2000/svg"
        className="block w-full h-auto overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* True silhouette clip — region fills are confined to it. */}
          <clipPath id={ids.silhouetteClip} clipPathUnits="userSpaceOnUse">
            <path d={BRAIN_SILHOUETTE_D} />
          </clipPath>

          {/* Subtle aura gradient — completion only. */}
          <radialGradient id={ids.aura} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--biv-cool))" stopOpacity="0.35" />
            <stop offset="55%" stopColor="hsl(var(--biv-cool))" stopOpacity="0.1" />
            <stop offset="100%" stopColor="hsl(var(--biv-cool))" stopOpacity="0" />
          </radialGradient>

          {/* Soft glow filter — used ONLY by completion aura. */}
          <filter id={ids.glow} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* ═══ Layer 1 — Brain silhouette + seam + internal wireframe ═══ */}
        <g>
          <path d={BRAIN_SILHOUETTE_D} className="biv-silhouette" />
          <path d={BRAIN_SEAM_D} className="biv-seam" />
          <g>
            {BRAIN_WIREFRAME_LEFT.map((d, i) => (
              <path key={`wl-${i}`} d={d} className="biv-wire" />
            ))}
            {BRAIN_WIREFRAME_RIGHT.map((d, i) => (
              <path key={`wr-${i}`} d={d} className="biv-wire" />
            ))}
          </g>
        </g>

        {/* ═══ Layer 6 — Region fills (clipped to true silhouette) ═══
            Drawn BEHIND wireframe so wireframe stays visible on top. */}
        <g clipPath={`url(#${ids.silhouetteClip})`}>
          {REGION_ORDER.map((id, i) => (
            <path
              key={id}
              d={REGION_PATHS[id]}
              className={regionClass(id)}
              style={{ opacity: m.regionOpacity[i] ?? 0 }}
            />
          ))}
        </g>

        {/* Re-draw wireframe on top of fills so internal structure stays
            visible regardless of how filled the regions are. */}
        <g style={{ pointerEvents: "none" }}>
          <path d={BRAIN_SEAM_D} className="biv-seam" />
          {BRAIN_WIREFRAME_LEFT.map((d, i) => (
            <path key={`wlf-${i}`} d={d} className="biv-wire" />
          ))}
          {BRAIN_WIREFRAME_RIGHT.map((d, i) => (
            <path key={`wrf-${i}`} d={d} className="biv-wire" />
          ))}
          {/* Silhouette stroke re-drawn on top for crisp edge over fills. */}
          <path
            d={BRAIN_SILHOUETTE_D}
            fill="none"
            stroke="hsl(var(--biv-fg) / 0.65)"
            strokeWidth={1.8}
          />
        </g>

        {/* ═══ Layer 2 — Passive branch skeleton ═══ */}
        <g className="biv-branch-skeleton">
          {BRANCHES.map((b) => (
            <path key={`skl-${b.id}`} d={b.d} />
          ))}
        </g>

        {/* ═══ Layer 3 — Active branch streams ═══ */}
        {stage !== "idle" && (
          <g>
            {BRANCHES.map((b) => (
              <path
                key={`str-${b.id}`}
                d={b.d}
                className={cn(
                  "biv-stream",
                  b.tier === "outer" && "biv-stream--outer",
                  b.tier === "mid" && "biv-stream--mid",
                  b.tier === "terminal" && "biv-stream--terminal",
                )}
                style={{ opacity: tierOpacity(b.tier) }}
              />
            ))}
          </g>
        )}

        {/* ═══ Layer 5 — Entry bridges (terminal → silhouette) ═══ */}
        {m.bridgeActivation > 0 && (
          <g>
            {ENTRY_BRIDGES.map((br, i) => (
              <path
                key={`br-${i}`}
                d={br.d}
                className="biv-bridge"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </g>
        )}

        {/* ═══ Layer 4 — Branch nodes (sequential pulse) ═══ */}
        <g>
          {BRANCH_NODES.map((n, i) => (
            <circle
              key={`nd-${i}`}
              cx={n.x}
              cy={n.y}
              r={n.tier === "terminal" ? 5 : 3.5}
              className={cn(
                "biv-node",
                n.tier === "terminal" && "biv-node--terminal",
              )}
              style={{ animationDelay: `${(i % 5) * 0.15}s` }}
            />
          ))}
        </g>

        {/* ═══ Layer 7 — Completion aura (minimal, end-only) ═══ */}
        <g className="biv-completion-aura">
          <circle
            cx={CX}
            cy={CY}
            r={460}
            fill={`url(#${ids.aura})`}
            filter={`url(#${ids.glow})`}
          />
        </g>

        {/* ═══ Layer 8 — File node glyphs ═══ */}
        {showFileNode && (
          <g className="biv-file-node">
            <FileGlyph x={FILE_LEFT.x} y={FILE_LEFT.y} mirrored={false} />
            <FileGlyph x={FILE_RIGHT.x} y={FILE_RIGHT.y} mirrored />
            {fileLabel && (
              <text
                x={CX}
                y={VB_H - 30}
                textAnchor="middle"
                fontSize={18}
                fill="hsl(var(--muted-foreground))"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                opacity={0.75}
              >
                {fileLabel}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}

function FileGlyph({
  x,
  y,
  mirrored,
}: {
  x: number;
  y: number;
  mirrored: boolean;
}) {
  const W = 64;
  const H = 84;
  const ox = mirrored ? x - W : x;
  return (
    <g transform={`translate(${ox}, ${y - H / 2})`}>
      <circle
        cx={W / 2}
        cy={H / 2}
        r={Math.max(W, H) * 0.7}
        className="biv-file-pulse"
      />
      <rect
        width={W}
        height={H}
        rx={6}
        fill="hsl(var(--card))"
        stroke="hsl(var(--foreground) / 0.6)"
        strokeWidth={1.4}
      />
      <path
        d={mirrored ? `M 0 0 L 12 0 L 0 12 Z` : `M ${W} 0 L ${W - 12} 0 L ${W} 12 Z`}
        fill="hsl(var(--muted))"
      />
      <g
        stroke="hsl(var(--foreground) / 0.45)"
        strokeWidth={1}
        strokeLinecap="round"
      >
        {[28, 38, 48, 58, 68].map((ly, i) => (
          <line key={i} x1={10} x2={W - 10 - (i % 2) * 8} y1={ly} y2={ly} />
        ))}
      </g>
    </g>
  );
}

export const BrainIngestionVisualizer = memo(BrainIngestionVisualizerComponent);
export default BrainIngestionVisualizer;
