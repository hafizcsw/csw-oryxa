import { useMemo } from "react";
import type { BrainIngestionMotion, BrainIngestionStage } from "./BrainIngestionVisualizer.types";

/**
 * Derive motion values from a stage + progress pair.
 * Pure function (memoised) so re-renders stay cheap.
 *
 * Stage thresholds (0..100):
 *   0–10   : file wake-up + outer nodes
 *  10–35   : outer + mid branches
 *  35–65   : terminal branches + bridges
 *  65–90   : brain regions fill (lower → mid → upper)
 *  90–100  : core seam + completion glow
 */
const REGION_THRESHOLDS = [0.65, 0.68, 0.72, 0.76, 0.82, 0.88, 0.92];

export function useBrainIngestionAnimation(
  stage: BrainIngestionStage,
  progress = 0,
): BrainIngestionMotion {
  return useMemo(() => {
    const p = Math.max(0, Math.min(100, progress)) / 100;

    const isError = stage === "error";
    const isComplete = stage === "complete";
    const isIdle = stage === "idle";

    // streamIntensity is mostly a function of stage.
    const streamIntensity =
      isIdle ? 0
      : stage === "uploading" ? 0.25
      : stage === "scanning" ? 0.6
      : stage === "extracting" ? 0.85
      : stage === "interpreting" ? 1
      : isComplete ? 0.35
      : 0.18;

    // branchActivation grows with progress, accelerated.
    const branchActivation = isIdle ? 0 : Math.min(1, p * 1.4);

    // brainFill: clamp to progress. Complete forces 1, idle/error hold their value.
    const brainFill = isComplete ? 1 : isIdle ? 0 : isError ? Math.min(0.85, p) : p;

    const stableGlow = isComplete ? 1 : 0;
    const errorDampening = isError ? 1 : 0;

    // Per-region reveal — each region starts unveiling once brainFill crosses
    // its threshold and reaches full opacity 12% later.
    const regionOpacity = REGION_THRESHOLDS.map((t) => {
      if (brainFill <= t) return 0;
      const span = 0.12;
      return Math.min(1, (brainFill - t) / span);
    });

    return {
      branchActivation,
      streamIntensity,
      brainFill,
      stableGlow,
      errorDampening,
      regionOpacity,
    };
  }, [stage, progress]);
}
