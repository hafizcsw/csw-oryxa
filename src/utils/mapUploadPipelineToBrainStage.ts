import type { BrainIngestionStage } from "@/components/intelligence/BrainIngestionVisualizer.types";

/**
 * Generic upload pipeline state — designed so the hero (which currently
 * tracks per-file `pending|active|done|failed`) can be adapted into the
 * 7-stage brain visualizer without coupling.
 */
export type UploadPipelineState = {
  uploadStatus?: "idle" | "uploading" | "uploaded" | "failed";
  parseStatus?: "idle" | "queued" | "scanning" | "extracting" | "parsed" | "failed";
  /** Optional progress 0..100 — if absent we synthesise from stage. */
  progress?: number;
};

export function mapPipelineToBrainStage(
  state: UploadPipelineState,
): { stage: BrainIngestionStage; progress: number } {
  const { uploadStatus = "idle", parseStatus = "idle", progress } = state;

  let stage: BrainIngestionStage = "idle";

  if (uploadStatus === "failed" || parseStatus === "failed") stage = "error";
  else if (parseStatus === "parsed") stage = "complete";
  else if (parseStatus === "extracting") stage = "interpreting";
  else if (parseStatus === "scanning") stage = "scanning";
  else if (parseStatus === "queued") stage = "extracting";
  else if (uploadStatus === "uploaded") stage = "scanning";
  else if (uploadStatus === "uploading") stage = "uploading";

  // Synthesise a progress fallback aligned with the stage band.
  const fallback =
    stage === "complete" ? 100
    : stage === "interpreting" ? 80
    : stage === "extracting" ? 55
    : stage === "scanning" ? 35
    : stage === "uploading" ? 12
    : stage === "error" ? Math.min(60, progress ?? 40)
    : 0;

  return {
    stage,
    progress: typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : fallback,
  };
}

/**
 * Adapter for the legacy per-file status array used by AIDataFlowHero.
 * Aggregates: any failed → error; all done → complete; otherwise the
 * "highest" in-flight phase wins, and progress = doneCount / total * 100.
 */
export function mapFileStatusesToBrainStage(
  statuses: Array<"pending" | "active" | "done" | "failed">,
  opts?: { isDragOver?: boolean; isUploading?: boolean },
): { stage: BrainIngestionStage; progress: number } {
  const total = statuses.length;
  if (total === 0) {
    return { stage: opts?.isDragOver ? "uploading" : "idle", progress: 0 };
  }

  const failed = statuses.some((s) => s === "failed");
  const active = statuses.filter((s) => s === "active").length;
  const done = statuses.filter((s) => s === "done" || s === "failed").length;
  const allDone = done === total;

  if (allDone && !failed) {
    return { stage: "complete", progress: 100 };
  }
  if (failed && active === 0) {
    return { stage: "error", progress: Math.round((done / total) * 100) };
  }

  // Smooth progress: completed fraction + half-credit for active files.
  const progress = Math.round(((done + active * 0.5) / total) * 100);

  let stage: BrainIngestionStage = "scanning";
  if (opts?.isUploading) stage = "uploading";
  else if (active === 0 && done < total) stage = "uploading";
  else if (progress < 30) stage = "scanning";
  else if (progress < 65) stage = "extracting";
  else stage = "interpreting";

  return { stage, progress };
}
