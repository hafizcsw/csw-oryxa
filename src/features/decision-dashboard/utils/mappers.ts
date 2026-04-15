import type { FunnelStep } from "../types";

/** Compute conversion % between current and previous step (same domain only) */
export function computeConversion(current: FunnelStep, prev: FunnelStep, sameDomain: boolean): string {
  if (!sameDomain || prev.visitors <= 0) return "—";
  return ((current.visitors / prev.visitors) * 100).toFixed(1);
}

/** Compute drop-off % between current and previous step (same domain only) */
export function computeDropoff(current: FunnelStep, prev: FunnelStep, sameDomain: boolean): string {
  if (!sameDomain || prev.visitors <= 0) return "—";
  return (((prev.visitors - current.visitors) / prev.visitors) * 100).toFixed(1);
}
