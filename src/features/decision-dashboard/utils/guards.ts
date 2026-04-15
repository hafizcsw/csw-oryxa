import type { FunnelStep } from "../types";

/** Check if conversion math is valid between two adjacent funnel steps */
export function isSameDomain(current: FunnelStep, prev: FunnelStep): boolean {
  return current.identity_domain === prev.identity_domain && current.count_source === prev.count_source;
}

/** Check if domain changed between two adjacent funnel steps */
export function isDomainChanged(current: FunnelStep, prev: FunnelStep): boolean {
  return current.identity_domain !== prev.identity_domain || current.count_source !== prev.count_source;
}
