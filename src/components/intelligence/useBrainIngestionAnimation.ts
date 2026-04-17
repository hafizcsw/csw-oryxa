import { useMemo } from "react";
import type {
  BrainIngestionMotion,
  BrainIngestionStage,
} from "./BrainIngestionVisualizer.types";

/**
 * Derive motion values from (stage, progress).
 * Pure + memoised so re-renders stay cheap.
 *
 * Region thresholds describe WHEN each silhouette-clipped region
 * starts revealing (in 0..1 progress space). Span = how long it
 * takes to fully reveal once it crosses its threshold.
 *
 * Order matches REGION_ORDER in brainGeometry.ts:
 *   left-lower, right-lower, left-mid, right-mid,
 *   left-upper, right-upper, core-seam
 */
const REGION_THRESHOLDS = [0.18, 0.26, 0.4, 0.52, 0.68, 0.8, 0.92];
const REGION_SPAN = 0.1;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function useBrainIngestionAnimation(
  stage: BrainIngestionStage,
  progress = 0,
): BrainIngestionMotion {
  return useMemo(() => {
    const p = clamp01(Math.max(0, Math.min(100, progress)) / 100);

    const isIdle = stage === "idle";
    const isComplete = stage === "complete";
    const isError = stage === "error";

    // Branch activation grows in 3 readable steps.
    const branchActivation = isIdle
      ? 0
      : p < 0.12
        ? 0.3
        : p < 0.35
          ? 0.6
          : p < 0.65
            ? 0.85
            : 1;

    // Stream intensity follows the stage (visible motion energy).
    const streamIntensity = isIdle
      ? 0
      : stage === "uploading"
        ? 0.35
        : stage === "scanning"
          ? 0.65
          : stage === "extracting"
            ? 0.9
            : stage === "interpreting"
              ? 1
              : isComplete
                ? 0.4
                : 0.2;

    // Bridge activation kicks in once we have meaningful inflow.
    const bridgeActivation = isIdle
      ? 0
      : p < 0.3
        ? 0
        : p < 0.55
          ? 0.5
          : 1;

    // Brain fill = progress, except complete forces 1, idle 0.
    const brainFill = isComplete ? 1 : isIdle ? 0 : p;

    const stableGlow = isComplete ? 1 : 0;
    const errorDampening = isError ? 1 : 0;

    // Per-region opacity — segmented, NOT a global wash.
    const regionOpacity = REGION_THRESHOLDS.map((t) => {
      if (isIdle) return 0;
      if (isComplete) return 1;
      const eff = isError ? Math.min(0.7, p) : p;
      if (eff <= t) return 0;
      return clamp01((eff - t) / REGION_SPAN);
    });

    return {
      branchActivation,
      streamIntensity,
      brainFill,
      stableGlow,
      errorDampening,
      regionOpacity,
      bridgeActivation,
    };
  }, [stage, progress]);
}
