/**
 * ============================================================
 * MAP FILTER CONTRACT — Shared typed filter state for map + search parity
 * ============================================================
 *
 * Semantics:
 * - degree_slug: canonical slug (e.g. "bachelor", "master", "phd")
 * - fees_max: tuition_usd_year_min <= fees_max (annual USD, same as search)
 * - region: visual-only grouping of ISO A2 codes (not sent to RPCs)
 *
 * Count semantics:
 * - universities_count = COUNT(DISTINCT university_id) from programs matching filters
 * - programs_count = COUNT(DISTINCT program_id) from programs matching filters
 * - Tooltip shows universities_count (primary) + programs_count (secondary)
 */

import { useState, useMemo, useCallback } from "react";

export interface MapFilterState {
  /** Visual region grouping — NOT sent to RPCs */
  region: string;
  /** Canonical degree slug — sent to RPCs */
  degree_slug: string;
  /** Max annual tuition USD — sent to RPCs, compares tuition_usd_year_min */
  fees_max: number;
}

/** RPC-ready filter params (excludes visual-only fields) */
export interface MapRpcParams {
  p_degree_slug: string | null;
  p_fees_max: number | null;
}

const DEFAULT_FEES_MAX = 50000;

export function useMapFilters() {
  const [region, setRegion] = useState("all");
  const [degreeSlug, setDegreeSlug] = useState("all");
  const [feesMax, setFeesMax] = useState(DEFAULT_FEES_MAX);

  const filters: MapFilterState = useMemo(() => ({
    region,
    degree_slug: degreeSlug,
    fees_max: feesMax,
  }), [region, degreeSlug, feesMax]);

  /** Convert UI state to RPC params (null = no filter) */
  const rpcParams: MapRpcParams = useMemo(() => ({
    p_degree_slug: degreeSlug === "all" ? null : degreeSlug,
    p_fees_max: feesMax >= DEFAULT_FEES_MAX ? null : feesMax,
  }), [degreeSlug, feesMax]);

  const resetFilters = useCallback(() => {
    setRegion("all");
    setDegreeSlug("all");
    setFeesMax(DEFAULT_FEES_MAX);
  }, []);

  return {
    filters,
    rpcParams,
    setRegion,
    setDegreeSlug,
    setFeesMax,
    resetFilters,
    DEFAULT_FEES_MAX,
  };
}
