/**
 * ORX 2.0 Dimension Readiness — Client-side evaluation
 *
 * Provides readiness assessment for Living / Work & Mobility / ROI dimensions.
 * Evaluates whether a dimension has sufficient facts to begin scoring.
 *
 * Does NOT create scores. Only evaluates readiness.
 */

import type { OrxDimensionDomain } from '@/types/orxSourceGovernance';

// ── Readiness thresholds ──

export interface ReadinessThresholds {
  min_entities: number;
  min_coverage: number;
  min_comparability: number;
  max_sparsity_pct: number;
  min_fact_families: number;
  min_source_diversity: number;
}

export const DEFAULT_THRESHOLDS: ReadinessThresholds = {
  min_entities: 10,
  min_coverage: 50,
  min_comparability: 40,
  max_sparsity_pct: 30,
  min_fact_families: 3,
  min_source_diversity: 2,
};

// ── Required fact families per dimension ──

export const REQUIRED_FACT_FAMILIES: Record<string, string[]> = {
  living: [
    'housing_availability',
    'housing_affordability',
    'transport_access',
    'city_safety_context',
  ],
  work_mobility: [
    'work_during_study_rights',
    'post_study_work_pathway',
    'degree_recognition_context',
  ],
  roi: [
    'tuition_band',
    'living_cost_band',
    'scholarship_availability',
  ],
};

// ── Readiness report ──

export interface DimensionReadinessReport {
  dimension: OrxDimensionDomain;
  scorable: boolean;
  blockers: string[];
  metrics: {
    total_facts: number;
    published_facts: number;
    approved_facts: number;
    pending_facts: number;
    unique_entities: number;
    source_diversity: number;
    fact_families_covered: number;
    avg_coverage: number;
    avg_comparability: number;
    sparsity_pct: number;
    regional_bias_pct: number;
  };
}

/**
 * Evaluate readiness from DB readiness view data.
 */
export function evaluateReadiness(
  row: Record<string, any>,
  thresholds: ReadinessThresholds = DEFAULT_THRESHOLDS
): DimensionReadinessReport {
  const dimension = row.dimension_domain as OrxDimensionDomain;
  const required = REQUIRED_FACT_FAMILIES[dimension] || [];
  const blockers: string[] = [];

  const metrics = {
    total_facts: Number(row.total_facts) || 0,
    published_facts: Number(row.published_facts) || 0,
    approved_facts: Number(row.approved_facts) || 0,
    pending_facts: Number(row.pending_facts) || 0,
    unique_entities: Number(row.unique_entities) || 0,
    source_diversity: Number(row.source_diversity) || 0,
    fact_families_covered: Number(row.fact_families_covered) || 0,
    avg_coverage: Number(row.avg_coverage) || 0,
    avg_comparability: Number(row.avg_comparability) || 0,
    sparsity_pct: Number(row.sparsity_pct) || 0,
    regional_bias_pct: Number(row.regional_bias_pct) || 0,
  };

  if (metrics.unique_entities < thresholds.min_entities)
    blockers.push(`Entities: ${metrics.unique_entities}/${thresholds.min_entities}`);

  if (metrics.avg_coverage < thresholds.min_coverage)
    blockers.push(`Coverage: ${Math.round(metrics.avg_coverage)}%/${thresholds.min_coverage}%`);

  if (metrics.avg_comparability < thresholds.min_comparability)
    blockers.push(`Comparability: ${Math.round(metrics.avg_comparability)}%/${thresholds.min_comparability}%`);

  if (metrics.sparsity_pct > thresholds.max_sparsity_pct)
    blockers.push(`Sparsity: ${Math.round(metrics.sparsity_pct)}%>${thresholds.max_sparsity_pct}%`);

  if (metrics.fact_families_covered < required.length)
    blockers.push(`Families: ${metrics.fact_families_covered}/${required.length}`);

  if (metrics.source_diversity < thresholds.min_source_diversity)
    blockers.push(`Sources: ${metrics.source_diversity}/${thresholds.min_source_diversity}`);

  return {
    dimension,
    scorable: blockers.length === 0,
    blockers,
    metrics,
  };
}
