/**
 * ORX 2.0 Dimension Facts — Type definitions & validation
 *
 * Typed layer for the orx_dimension_facts table.
 * Supports Living / Work & Mobility / ROI fact families.
 * Internal-only until explicit public promotion.
 */

import type { OrxSourceFamily, OrxDimensionDomain, OrxFactBoundary } from './orxSourceGovernance';

// ── Fact status lifecycle ──

export type OrxDimensionFactStatus =
  | 'candidate'
  | 'internal_approved'
  | 'published'
  | 'rejected'
  | 'stale'
  | 'superseded';

// ── DB row type ──

export interface OrxDimensionFactRow {
  id: string;
  boundary_type: OrxFactBoundary;
  entity_type: string;
  entity_id: string;
  dimension_domain: OrxDimensionDomain;
  fact_family: string;
  fact_key: string;
  fact_value: Record<string, unknown>;
  display_text: string | null;
  source_url: string | null;
  source_domain: string | null;
  source_family: OrxSourceFamily;
  source_type: string | null;
  confidence: number | null;
  coverage_score: number | null;
  comparability_score: number | null;
  sparsity_flag: boolean;
  regional_bias_flag: boolean;
  freshness_date: string | null;
  status: OrxDimensionFactStatus;
  methodology_version: string;
  first_seen_at: string;
  last_seen_at: string;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Insert shape ──

export interface OrxDimensionFactInsert {
  boundary_type: OrxFactBoundary;
  entity_type: string;
  entity_id: string;
  dimension_domain: OrxDimensionDomain;
  fact_family: string;
  fact_key: string;
  fact_value: Record<string, unknown>;
  display_text?: string | null;
  source_url?: string | null;
  source_domain?: string | null;
  source_family: string;
  source_type?: string | null;
  confidence?: number | null;
  coverage_score?: number | null;
  comparability_score?: number | null;
  sparsity_flag?: boolean;
  regional_bias_flag?: boolean;
  freshness_date?: string | null;
  status?: OrxDimensionFactStatus;
  methodology_version?: string;
}

// ── Fact families by dimension ──

export const ORX_LIVING_FACT_FAMILIES = [
  'housing_availability',
  'housing_affordability',
  'housing_quality',
  'transport_access',
  'student_support',
  'city_safety_context',
] as const;

export const ORX_WORK_MOBILITY_FACT_FAMILIES = [
  'work_during_study_rights',
  'weekly_work_cap',
  'post_study_work_pathway',
  'sponsorship_environment',
  'degree_recognition_context',
  'language_barrier_context',
] as const;

export const ORX_ROI_FACT_FAMILIES = [
  'tuition_band',
  'living_cost_band',
  'scholarship_availability',
  'cost_pressure_context',
  'earning_offset_context',
] as const;

export type OrxLivingFactFamily = typeof ORX_LIVING_FACT_FAMILIES[number];
export type OrxWorkMobilityFactFamily = typeof ORX_WORK_MOBILITY_FACT_FAMILIES[number];
export type OrxRoiFactFamily = typeof ORX_ROI_FACT_FAMILIES[number];

/** All ORX 2.0 fact families */
export const ORX_2_FACT_FAMILIES = [
  ...ORX_LIVING_FACT_FAMILIES,
  ...ORX_WORK_MOBILITY_FACT_FAMILIES,
  ...ORX_ROI_FACT_FAMILIES,
] as const;

/** Map fact families to their dimension domain */
export const FACT_FAMILY_TO_DOMAIN: Record<string, OrxDimensionDomain> = {};
for (const f of ORX_LIVING_FACT_FAMILIES) FACT_FAMILY_TO_DOMAIN[f] = 'living';
for (const f of ORX_WORK_MOBILITY_FACT_FAMILIES) FACT_FAMILY_TO_DOMAIN[f] = 'work_mobility';
for (const f of ORX_ROI_FACT_FAMILIES) FACT_FAMILY_TO_DOMAIN[f] = 'roi';

/**
 * Check if a fact family is valid for ORX 2.0
 */
export function isValidFactFamily(family: string): boolean {
  return (ORX_2_FACT_FAMILIES as readonly string[]).includes(family);
}

/**
 * Get the dimension domain for a fact family
 */
export function getDomainForFamily(family: string): OrxDimensionDomain | null {
  return FACT_FAMILY_TO_DOMAIN[family] ?? null;
}
