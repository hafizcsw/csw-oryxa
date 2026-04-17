// ═══════════════════════════════════════════════════════════════
// BrainIngestionVisualizer — public types
// ═══════════════════════════════════════════════════════════════
// Stateful brain-based metaphor for the file ingestion pipeline.
// 7-stage state machine, progress 0..100, no hardcoded text inside
// the component itself — labels come from the parent (i18n-safe).
// ═══════════════════════════════════════════════════════════════

export type BrainIngestionStage =
  | "idle"
  | "uploading"
  | "scanning"
  | "extracting"
  | "interpreting"
  | "complete"
  | "error";

export interface BrainIngestionVisualizerProps {
  /** Stage of the ingestion pipeline. */
  stage: BrainIngestionStage;
  /** 0..100 — drives branch reveal, brain fill, completion stability. */
  progress?: number;
  /** Optional motion strength scaler. Default 1. */
  intensity?: number;
  /** Show the side file glyph + pulse. */
  showFileNode?: boolean;
  /** Localized label rendered next to the file glyph (already translated). */
  fileLabel?: string;
  /** Master animate flag — false renders a static state. */
  animate?: boolean;
  /** Force-reduce motion. If undefined, uses prefers-reduced-motion. */
  reducedMotion?: boolean;
  className?: string;
  /** Optional aria-label (already translated). Decorative by default. */
  ariaLabel?: string;
}

/** Motion values derived from stage + progress. */
export interface BrainIngestionMotion {
  /** 0..1 — share of branch tiers visually active. */
  branchActivation: number;
  /** 0..1 — speed/brightness multiplier of stream pulses. */
  streamIntensity: number;
  /** 0..1 — brain interior fill ratio (region-by-region). */
  brainFill: number;
  /** 0|1 — stable completion glow active. */
  stableGlow: number;
  /** 0|1 — error dampening active. */
  errorDampening: number;
  /** Per-region opacity 0..1, in order: L-lower, R-lower, L-mid, R-mid, L-upper, R-upper, core-seam. */
  regionOpacity: number[];
  /** 0..1 — entry bridge activation (terminal conduit → silhouette). */
  bridgeActivation: number;
}
