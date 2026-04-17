// ═══════════════════════════════════════════════════════════════
// BrainIngestionVisualizer
// ───────────────────────────────────────────────────────────────
// Stateful brain-based intelligence ingestion visual. NOT a loader.
// 7 explicit layers driven by a (stage, progress) state machine.
//
// Layers:
//  1. base brain geometry          (always visible, faint)
//  2. passive branch skeleton      (always visible, dim)
//  3. active branch streams        (animated, branch tiers reveal)
//  4. branch nodes                 (sequential pulse activation)
//  5. inflow bridges               (terminal → cortex)
//  6. brain interior fill regions  (region-by-region reveal)
//  7. completion aura              (stable glow at the end)
//
// All colors via design tokens. Zero visible hardcoded text.
// ═══════════════════════════════════════════════════════════════

import { memo, useId } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import brainAnatomical from "@/assets/brain-anatomical.svg";
import { useBrainIngestionAnimation } from "./useBrainIngestionAnimation";
import type { BrainIngestionVisualizerProps } from "./BrainIngestionVisualizer.types";
import "./brain-ingestion.css";

const VB_W = 1600;
const VB_H = 900;
const CX = VB_W / 2;
const CY = VB_H / 2;

// ─── Branch geometry (semantic, NOT auto-extracted from raster SVG) ──
// Three tiers per side, flowing inward from the file source toward the brain.
type Branch = { d: string; tier: "outer" | "mid" | "terminal" };

const LEFT_BRANCHES: Branch[] = [
  // Outer (start far left, broad sweep)
  { d: `M 80 220 C 240 200, 360 280, 520 320`, tier: "outer" },
  { d: `M 60 460 C 220 480, 360 440, 520 420`, tier: "outer" },
  { d: `M 90 660 C 240 640, 380 580, 520 520`, tier: "outer" },
  // Mid
  { d: `M 240 280 C 360 320, 460 360, 580 380`, tier: "mid" },
  { d: `M 220 520 C 360 500, 460 480, 580 460`, tier: "mid" },
  { d: `M 260 620 C 380 580, 480 540, 580 520`, tier: "mid" },
  // Terminal (short bridges into cortex perimeter)
  { d: `M 580 380 C 640 380, 680 400, 720 410`, tier: "terminal" },
  { d: `M 580 460 C 640 460, 680 460, 720 460`, tier: "terminal" },
  { d: `M 580 520 C 640 510, 680 500, 720 490`, tier: "terminal" },
];

const RIGHT_BRANCHES: Branch[] = LEFT_BRANCHES.map((b) => ({
  ...b,
  d: mirrorPath(b.d, VB_W),
}));

function mirrorPath(d: string, width: number): string {
  return d.replace(/(-?\d+(?:\.\d+)?)(\s|,)/g, (_m, num, sep, idx, full) => {
    // Only mirror x-coords. Heuristic: alternate numbers in M/C/L commands
    // are x then y. We track parity via a closure-ish global rebuild below.
    return num + sep;
  });
  // Simple parity rebuild instead — robust:
}
// Replace simplistic mirrorPath with a parity-aware version.
function mirrorPathSafe(d: string, width: number): string {
  let xTurn = true;
  return d.replace(/-?\d+(?:\.\d+)?/g, (num) => {
    const v = parseFloat(num);
    const out = xTurn ? width - v : v;
    xTurn = !xTurn;
    return String(out);
  });
}
// Reassign RIGHT_BRANCHES using the safe mirror (TS-friendly: inline iife).
const RIGHT_BRANCHES_FIXED: Branch[] = LEFT_BRANCHES.map((b) => {
  // Reset parity per path: M cmd starts with x.
  let xTurn = true;
  const d = b.d.replace(/-?\d+(?:\.\d+)?/g, (num) => {
    const v = parseFloat(num);
    const out = xTurn ? VB_W - v : v;
    xTurn = !xTurn;
    return String(out);
  });
  return { ...b, d };
});

// ─── Branch end-nodes (small circles where pulses peak) ────────────
const NODE_POINTS_LEFT = [
  { x: 240, y: 280, tier: "mid" as const },
  { x: 220, y: 520, tier: "mid" as const },
  { x: 580, y: 380, tier: "terminal" as const },
  { x: 580, y: 460, tier: "terminal" as const },
  { x: 580, y: 520, tier: "terminal" as const },
];
const NODE_POINTS_RIGHT = NODE_POINTS_LEFT.map((n) => ({ ...n, x: VB_W - n.x }));

// ─── File node positions (off-canvas anchors visualised as glyphs) ─
const FILE_LEFT = { x: 60, y: 440 };
const FILE_RIGHT = { x: VB_W - 60, y: 440 };

// ─── Brain interior region rectangles (overlays inside silhouette) ─
// Order matches REGION_THRESHOLDS in the hook:
// L-lower, R-lower, L-mid, R-mid, L-upper, R-upper, core-seam
const REGIONS: Array<{ id: string; cx: number; cy: number; rx: number; ry: number }> = [
  { id: "l-lower",   cx: CX - 90, cy: CY + 70, rx: 95, ry: 70 },
  { id: "r-lower",   cx: CX + 90, cy: CY + 70, rx: 95, ry: 70 },
  { id: "l-mid",     cx: CX - 95, cy: CY,      rx: 100, ry: 70 },
  { id: "r-mid",     cx: CX + 95, cy: CY,      rx: 100, ry: 70 },
  { id: "l-upper",   cx: CX - 70, cy: CY - 80, rx: 95, ry: 70 },
  { id: "r-upper",   cx: CX + 70, cy: CY - 80, rx: 95, ry: 70 },
  { id: "core-seam", cx: CX,      cy: CY,      rx: 60, ry: 130 },
];

// Brain silhouette clipPath (simplified two-hemisphere).
const BRAIN_SILHOUETTE_D = (() => {
  const x = CX, y = CY, w = 320, h = 230;
  return (
    `M ${x - w} ${y - 30} ` +
    `C ${x - w - 10} ${y - 130}, ${x - w / 2} ${y - h}, ${x - 60} ${y - h * 0.95} ` +
    `C ${x - 30} ${y - h - 8}, ${x + 30} ${y - h - 8}, ${x + 60} ${y - h * 0.95} ` +
    `C ${x + w / 2} ${y - h}, ${x + w + 10} ${y - 130}, ${x + w} ${y - 30} ` +
    `C ${x + w + 6} ${y + 90}, ${x + w / 2} ${y + h - 10}, ${x + 50} ${y + h - 30} ` +
    `C ${x + 30} ${y + h}, ${x - 30} ${y + h}, ${x - 50} ${y + h - 30} ` +
    `C ${x - w / 2} ${y + h - 10}, ${x - w - 6} ${y + 90}, ${x - w} ${y - 30} Z`
  );
})();

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
    silhouette: `biv-clip-${uid}`,
    fillGrad: `biv-fill-${uid}`,
    streamGrad: `biv-stream-${uid}`,
    aura: `biv-aura-${uid}`,
    chipFace: `biv-chip-${uid}`,
    glow: `biv-glow-${uid}`,
  };

  // CSS vars driving all keyframes.
  const styleVars = {
    ["--biv-branch-activation" as string]: m.branchActivation,
    ["--biv-stream-intensity" as string]: m.streamIntensity,
    ["--biv-brain-fill" as string]: m.brainFill,
    ["--biv-stable-glow" as string]: m.stableGlow,
    ["--biv-error-dampening" as string]: m.errorDampening,
  } as React.CSSProperties;

  const showStreams = stage !== "idle";
  const showBridges = ["scanning", "extracting", "interpreting", "complete"].includes(stage);

  return (
    <div
      className={cn("biv-root relative", className)}
      data-stage={stage}
      data-progress={Math.round(progress)}
      data-reduced-motion={reduced ? "true" : "false"}
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
          <clipPath id={ids.silhouette}>
            <path d={BRAIN_SILHOUETTE_D} />
          </clipPath>

          <radialGradient id={ids.fillGrad} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
            <stop offset="55%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={ids.streamGrad} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--accent, var(--primary)))" stopOpacity="0.9" />
          </linearGradient>

          <radialGradient id={ids.aura} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
            <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={ids.chipFace} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.65" />
          </linearGradient>

          <filter id={ids.glow} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* ═══ Layer 1 — base brain geometry (decorative raster reference) ═══ */}
        <g className="biv-base">
          <image
            href={brainAnatomical}
            x={CX - 360}
            y={CY - 270}
            width={720}
            height={540}
            preserveAspectRatio="xMidYMid meet"
            opacity={0.8}
          />
        </g>

        {/* ═══ Layer 2 — passive branch skeleton (always present) ═══ */}
        <g className="biv-branch-skeleton" stroke="hsl(var(--foreground))" strokeWidth="0.8" fill="none" strokeOpacity="0.6">
          {LEFT_BRANCHES.map((b, i) => (
            <path key={`skl-l-${i}`} d={b.d} />
          ))}
          {RIGHT_BRANCHES_FIXED.map((b, i) => (
            <path key={`skl-r-${i}`} d={b.d} />
          ))}
        </g>

        {/* ═══ Layer 3 — active branch streams (CSS-animated dash flow) ═══ */}
        {showStreams && (
          <g fill="none">
            {LEFT_BRANCHES.map((b, i) => (
              <path
                key={`str-l-${i}`}
                d={b.d}
                className={cn(
                  "biv-stream",
                  b.tier === "mid" && "biv-stream--mid",
                  b.tier === "terminal" && "biv-stream--terminal",
                )}
                style={{
                  // Tier reveal: outer first, mid next, terminal last.
                  opacity:
                    b.tier === "outer" ? Math.min(1, m.branchActivation * 1.6)
                    : b.tier === "mid" ? Math.min(1, Math.max(0, m.branchActivation - 0.2) * 1.6)
                    : Math.min(1, Math.max(0, m.branchActivation - 0.45) * 1.8),
                }}
              />
            ))}
            {RIGHT_BRANCHES_FIXED.map((b, i) => (
              <path
                key={`str-r-${i}`}
                d={b.d}
                className={cn(
                  "biv-stream",
                  b.tier === "mid" && "biv-stream--mid",
                  b.tier === "terminal" && "biv-stream--terminal",
                )}
                style={{
                  opacity:
                    b.tier === "outer" ? Math.min(1, m.branchActivation * 1.6)
                    : b.tier === "mid" ? Math.min(1, Math.max(0, m.branchActivation - 0.2) * 1.6)
                    : Math.min(1, Math.max(0, m.branchActivation - 0.45) * 1.8),
                }}
              />
            ))}
          </g>
        )}

        {/* ═══ Layer 4 — branch nodes (sequential pulse) ═══ */}
        <g>
          {[...NODE_POINTS_LEFT, ...NODE_POINTS_RIGHT].map((n, i) => (
            <circle
              key={`nd-${i}`}
              cx={n.x}
              cy={n.y}
              r={4}
              className={cn("biv-node", n.tier === "terminal" && "biv-node--warm")}
              style={{ animationDelay: `${(i % 5) * 0.18}s` }}
            />
          ))}
        </g>

        {/* ═══ Layer 5 — inflow bridges into cortex perimeter ═══ */}
        {showBridges && (
          <g fill="none">
            {[
              `M 720 410 C 760 405, 790 400, 820 400`,
              `M 720 460 C 760 460, 790 460, 820 460`,
              `M 720 490 C 760 495, 790 500, 820 500`,
              `M ${VB_W - 720} 410 C ${VB_W - 760} 405, ${VB_W - 790} 400, ${VB_W - 820} 400`,
              `M ${VB_W - 720} 460 C ${VB_W - 760} 460, ${VB_W - 790} 460, ${VB_W - 820} 460`,
              `M ${VB_W - 720} 490 C ${VB_W - 760} 495, ${VB_W - 790} 500, ${VB_W - 820} 500`,
            ].map((d, i) => (
              <path key={`br-${i}`} d={d} className="biv-bridge" style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </g>
        )}

        {/* ═══ Layer 6 — brain interior fill (region-by-region) ═══ */}
        <g clipPath={`url(#${ids.silhouette})`}>
          {REGIONS.map((r, i) => (
            <ellipse
              key={r.id}
              cx={r.cx}
              cy={r.cy}
              rx={r.rx}
              ry={r.ry}
              fill={`url(#${ids.fillGrad})`}
              className="biv-region"
              opacity={m.regionOpacity[i] ?? 0}
            />
          ))}
        </g>

        {/* ═══ Layer 7 — completion aura ═══ */}
        <g className="biv-completion-aura">
          <circle cx={CX} cy={CY} r={260} fill={`url(#${ids.aura})`} />
        </g>

        {/* ═══ File node glyphs (left + right) ═══ */}
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
                opacity={0.7}
              >
                {fileLabel}
              </text>
            )}
          </g>
        )}

        {/* Suppress unused-id warnings — chip/streamGrad reserved for future tier upgrades. */}
        <use href={`#${ids.chipFace}`} x={-9999} y={-9999} />
        <use href={`#${ids.streamGrad}`} x={-9999} y={-9999} />
      </svg>
    </div>
  );
}

function FileGlyph({ x, y, mirrored }: { x: number; y: number; mirrored: boolean }) {
  const W = 64;
  const H = 84;
  const ox = mirrored ? x - W : x;
  return (
    <g transform={`translate(${ox}, ${y - H / 2})`}>
      <circle cx={W / 2} cy={H / 2} r={Math.max(W, H) * 0.7} className="biv-file-pulse" />
      <rect
        width={W}
        height={H}
        rx={6}
        fill="hsl(var(--card))"
        stroke="hsl(var(--foreground))"
        strokeOpacity={0.55}
        strokeWidth={1.2}
      />
      <path
        d={mirrored ? `M 0 0 L 12 0 L 0 12 Z` : `M ${W} 0 L ${W - 12} 0 L ${W} 12 Z`}
        fill="hsl(var(--muted))"
      />
      <g stroke="hsl(var(--foreground))" strokeOpacity={0.4} strokeWidth={1} strokeLinecap="round">
        {[28, 38, 48, 58, 68].map((ly, i) => (
          <line key={i} x1={10} x2={W - 10 - (i % 2) * 8} y1={ly} y2={ly} />
        ))}
      </g>
    </g>
  );
}

export const BrainIngestionVisualizer = memo(BrainIngestionVisualizerComponent);
export default BrainIngestionVisualizer;
