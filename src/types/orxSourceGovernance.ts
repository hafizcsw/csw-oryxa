/**
 * ORX Source Governance & Normalization Layer — Bootstrap v1
 *
 * Defines the governance scaffolding for how data sources are classified,
 * policy-gated, and comparability-scored before ORX 2.0 expansion
 * (Living, Work/Mobility, ROI dimensions).
 *
 * This is config-first: no scoring engine, no new DB tables yet.
 * Pure type + policy matrix consumed by future pipelines.
 */

// ── Source Family Classification ──

export type OrxSourceFamily =
  // Core ORX 1.0 families
  | 'official_website'
  | 'official_pdf'
  | 'course_catalog'
  | 'government_report'
  | 'accreditation_body'
  | 'structured_data'
  // ORX 2.0 expansion families
  | 'labor_statistics'
  | 'housing_reference'
  | 'city_reference'
  | 'cost_of_living_index'
  | 'visa_immigration_source'
  | 'alumni_outcome_data'
  | 'salary_survey'
  | 'employer_survey'
  // Contextual-only families
  | 'third_party_contextual'
  | 'news_press'
  | 'verified_student';

// ── Dimension Domains ──

export type OrxDimensionDomain =
  | 'core'              // ORX 1.0: future-readiness scoring
  | 'living'            // City/country living conditions
  | 'work_mobility'     // Post-graduation employment, visa, labor market
  | 'roi'              // Return on investment, salary vs cost
  | 'fit';             // Student-specific personalization (future)

// ── Entity Boundary ──

export type OrxFactBoundary =
  | 'country'
  | 'city'
  | 'institution'
  | 'program';

// ── Source Policy Entry ──

export interface OrxSourcePolicy {
  family: OrxSourceFamily;
  
  /** Which dimensions this source is allowed to feed */
  allowed_domains: OrxDimensionDomain[];
  
  /** Whether this source can be used as primary evidence */
  primary_source: boolean;
  
  /** Whether this source can be used as fallback when primary is missing */
  fallback_source: boolean;
  
  /** Whether this source is contextual-only (cannot be sole basis for scoring) */
  contextual_only: boolean;
  
  /** Maximum freshness window in days before evidence is considered stale */
  freshness_window_days: number;
  
  /** Geographic scope of comparability */
  comparability_scope: 'global' | 'regional' | 'national' | 'institutional';
  
  /** Whether source is only available/meaningful in certain regions */
  regional_only: boolean;
  
  /** Modifier applied to confidence when using this source type (-1.0 to +1.0) */
  confidence_modifier: number;
  
  /** Entity boundaries this source can provide facts for */
  fact_boundaries: OrxFactBoundary[];
}

// ── Coverage & Comparability Metadata ──

export interface OrxCoverageMetadata {
  dimension: OrxDimensionDomain;
  fact_boundary: OrxFactBoundary;
  
  /** 0–100: how much of the target population has data */
  coverage_score: number;
  
  /** 0–100: how comparable the data is across entities */
  comparability_score: number;
  
  /** Whether data is too sparse to score reliably */
  sparsity_flag: boolean;
  
  /** Whether data has known regional bias (e.g. US-centric salary data) */
  regional_bias_flag: boolean;
  
  /** Minimum coverage_score required before dimension can be scored */
  scoring_threshold: number;
  
  /** Human-readable note about the coverage state */
  note: string;
}

// ══════════════════════════════════════════════
// SOURCE POLICY MATRIX — Config-first definition
// ══════════════════════════════════════════════

export const ORX_SOURCE_POLICY_MATRIX: OrxSourcePolicy[] = [
  // ── Core ORX 1.0 sources ──
  {
    family: 'official_website',
    allowed_domains: ['core', 'living', 'work_mobility'],
    primary_source: true,
    fallback_source: false,
    contextual_only: false,
    freshness_window_days: 365,
    comparability_scope: 'institutional',
    regional_only: false,
    confidence_modifier: 0,
    fact_boundaries: ['institution', 'program'],
  },
  {
    family: 'official_pdf',
    allowed_domains: ['core'],
    primary_source: true,
    fallback_source: false,
    contextual_only: false,
    freshness_window_days: 540,
    comparability_scope: 'institutional',
    regional_only: false,
    confidence_modifier: 0,
    fact_boundaries: ['institution', 'program'],
  },
  {
    family: 'course_catalog',
    allowed_domains: ['core'],
    primary_source: true,
    fallback_source: false,
    contextual_only: false,
    freshness_window_days: 365,
    comparability_scope: 'institutional',
    regional_only: false,
    confidence_modifier: 0.1,
    fact_boundaries: ['program'],
  },
  {
    family: 'government_report',
    allowed_domains: ['core', 'living', 'work_mobility', 'roi'],
    primary_source: true,
    fallback_source: false,
    contextual_only: false,
    freshness_window_days: 730,
    comparability_scope: 'national',
    regional_only: false,
    confidence_modifier: 0.1,
    fact_boundaries: ['country', 'city'],
  },
  {
    family: 'accreditation_body',
    allowed_domains: ['core'],
    primary_source: true,
    fallback_source: false,
    contextual_only: false,
    freshness_window_days: 1095,
    comparability_scope: 'global',
    regional_only: false,
    confidence_modifier: 0.15,
    fact_boundaries: ['institution', 'program'],
  },
  {
    family: 'structured_data',
    allowed_domains: ['core', 'living', 'work_mobility', 'roi'],
    primary_source: true,
    fallback_source: true,
    contextual_only: false,
    freshness_window_days: 365,
    comparability_scope: 'global',
    regional_only: false,
    confidence_modifier: 0.05,
    fact_boundaries: ['country', 'city', 'institution', 'program'],
  },

  // ── ORX 2.0 expansion sources ──
  {
    family: 'labor_statistics',
    allowed_domains: ['work_mobility', 'roi'],
    primary_source: true,
    fallback_source: false,
    contextual_only: false,
    freshness_window_days: 730,
    comparability_scope: 'national',
    regional_only: false,
    confidence_modifier: 0.1,
    fact_boundaries: ['country'],
  },
  {
    family: 'housing_reference',
    allowed_domains: ['living', 'roi'],
    primary_source: true,
    fallback_source: false,
    contextual_only: false,
    freshness_window_days: 180,
    comparability_scope: 'regional',
    regional_only: true,
    confidence_modifier: -0.1,
    fact_boundaries: ['city'],
  },
  {
    family: 'city_reference',
    allowed_domains: ['living'],
    primary_source: true,
    fallback_source: false,
    contextual_only: false,
    freshness_window_days: 365,
    comparability_scope: 'regional',
    regional_only: true,
    confidence_modifier: 0,
    fact_boundaries: ['city'],
  },
  {
    family: 'cost_of_living_index',
    allowed_domains: ['living', 'roi'],
    primary_source: true,
    fallback_source: true,
    contextual_only: false,
    freshness_window_days: 365,
    comparability_scope: 'global',
    regional_only: false,
    confidence_modifier: 0.05,
    fact_boundaries: ['city', 'country'],
  },
  {
    family: 'visa_immigration_source',
    allowed_domains: ['work_mobility'],
    primary_source: true,
    fallback_source: false,
    contextual_only: false,
    freshness_window_days: 365,
    comparability_scope: 'national',
    regional_only: false,
    confidence_modifier: 0,
    fact_boundaries: ['country'],
  },
  {
    family: 'alumni_outcome_data',
    allowed_domains: ['work_mobility', 'roi'],
    primary_source: true,
    fallback_source: false,
    contextual_only: false,
    freshness_window_days: 730,
    comparability_scope: 'institutional',
    regional_only: false,
    confidence_modifier: 0.1,
    fact_boundaries: ['institution', 'program'],
  },
  {
    family: 'salary_survey',
    allowed_domains: ['roi', 'work_mobility'],
    primary_source: false,
    fallback_source: true,
    contextual_only: false,
    freshness_window_days: 365,
    comparability_scope: 'regional',
    regional_only: true,
    confidence_modifier: -0.15,
    fact_boundaries: ['country', 'city'],
  },
  {
    family: 'employer_survey',
    allowed_domains: ['work_mobility'],
    primary_source: false,
    fallback_source: true,
    contextual_only: true,
    freshness_window_days: 365,
    comparability_scope: 'regional',
    regional_only: true,
    confidence_modifier: -0.2,
    fact_boundaries: ['country'],
  },

  // ── Contextual-only sources ──
  {
    family: 'third_party_contextual',
    allowed_domains: ['core', 'living', 'work_mobility'],
    primary_source: false,
    fallback_source: true,
    contextual_only: true,
    freshness_window_days: 365,
    comparability_scope: 'global',
    regional_only: false,
    confidence_modifier: -0.2,
    fact_boundaries: ['country', 'city', 'institution'],
  },
  {
    family: 'news_press',
    allowed_domains: ['core'],
    primary_source: false,
    fallback_source: false,
    contextual_only: true,
    freshness_window_days: 180,
    comparability_scope: 'global',
    regional_only: false,
    confidence_modifier: -0.3,
    fact_boundaries: ['institution'],
  },
  {
    family: 'verified_student',
    allowed_domains: ['core', 'living'],
    primary_source: false,
    fallback_source: false,
    contextual_only: true,
    freshness_window_days: 365,
    comparability_scope: 'institutional',
    regional_only: false,
    confidence_modifier: -0.1,
    fact_boundaries: ['institution', 'program'],
  },
];

// ══════════════════════════════════════════════
// COVERAGE BASELINE — Current state of each dimension
// ══════════════════════════════════════════════

export const ORX_COVERAGE_BASELINE: OrxCoverageMetadata[] = [
  // Core (ORX 1.0) — operational
  {
    dimension: 'core',
    fact_boundary: 'country',
    coverage_score: 75,
    comparability_score: 80,
    sparsity_flag: false,
    regional_bias_flag: false,
    scoring_threshold: 40,
    note: 'OECD/World Bank structured data provides strong baseline. Non-OECD gaps exist.',
  },
  {
    dimension: 'core',
    fact_boundary: 'institution',
    coverage_score: 60,
    comparability_score: 65,
    sparsity_flag: false,
    regional_bias_flag: false,
    scoring_threshold: 40,
    note: 'Official websites + catalogs available for most ranked universities. Extraction depth varies.',
  },
  {
    dimension: 'core',
    fact_boundary: 'program',
    coverage_score: 45,
    comparability_score: 55,
    sparsity_flag: false,
    regional_bias_flag: false,
    scoring_threshold: 30,
    note: 'Program-level evidence depends on catalog granularity. Improving with targeted crawls.',
  },

  // Living — not yet scored, governance only
  {
    dimension: 'living',
    fact_boundary: 'city',
    coverage_score: 30,
    comparability_score: 40,
    sparsity_flag: true,
    regional_bias_flag: true,
    scoring_threshold: 50,
    note: 'City enrichment table covers ~200 cities. Housing/cost data sparse outside major markets.',
  },
  {
    dimension: 'living',
    fact_boundary: 'country',
    coverage_score: 55,
    comparability_score: 60,
    sparsity_flag: false,
    regional_bias_flag: false,
    scoring_threshold: 50,
    note: 'Country-level living indicators available from international organizations.',
  },

  // Work/Mobility — not yet scored, governance only
  {
    dimension: 'work_mobility',
    fact_boundary: 'country',
    coverage_score: 35,
    comparability_score: 30,
    sparsity_flag: true,
    regional_bias_flag: true,
    scoring_threshold: 50,
    note: 'Visa/work permit data highly fragmented. Labor market stats US/EU-biased.',
  },
  {
    dimension: 'work_mobility',
    fact_boundary: 'institution',
    coverage_score: 15,
    comparability_score: 20,
    sparsity_flag: true,
    regional_bias_flag: true,
    scoring_threshold: 50,
    note: 'Alumni outcome data available for <5% of institutions. Major gap.',
  },

  // ROI — not yet scored, governance only
  {
    dimension: 'roi',
    fact_boundary: 'program',
    coverage_score: 10,
    comparability_score: 15,
    sparsity_flag: true,
    regional_bias_flag: true,
    scoring_threshold: 60,
    note: 'Program-level ROI requires tuition + salary + employment rate. All three sparse.',
  },
  {
    dimension: 'roi',
    fact_boundary: 'country',
    coverage_score: 40,
    comparability_score: 35,
    sparsity_flag: true,
    regional_bias_flag: true,
    scoring_threshold: 60,
    note: 'Country-level salary/cost data available but currency/PPP normalization needed.',
  },
];

// ══════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════

/**
 * Get source policy for a specific family.
 */
export function getSourcePolicy(family: OrxSourceFamily): OrxSourcePolicy | undefined {
  return ORX_SOURCE_POLICY_MATRIX.find(p => p.family === family);
}

/**
 * Check if a source family is allowed for a specific dimension.
 */
export function isSourceAllowedForDomain(
  family: OrxSourceFamily,
  domain: OrxDimensionDomain
): boolean {
  const policy = getSourcePolicy(family);
  return policy ? policy.allowed_domains.includes(domain) : false;
}

/**
 * Check if a source family can provide facts for a specific boundary.
 */
export function isSourceAllowedForBoundary(
  family: OrxSourceFamily,
  boundary: OrxFactBoundary
): boolean {
  const policy = getSourcePolicy(family);
  return policy ? policy.fact_boundaries.includes(boundary) : false;
}

/**
 * Get all source families allowed for a dimension.
 */
export function getSourcesForDomain(domain: OrxDimensionDomain): OrxSourcePolicy[] {
  return ORX_SOURCE_POLICY_MATRIX.filter(p => p.allowed_domains.includes(domain));
}

/**
 * Get primary sources for a dimension (non-contextual, non-fallback).
 */
export function getPrimarySourcesForDomain(domain: OrxDimensionDomain): OrxSourcePolicy[] {
  return ORX_SOURCE_POLICY_MATRIX.filter(
    p => p.allowed_domains.includes(domain) && p.primary_source && !p.contextual_only
  );
}

/**
 * Check if a dimension has sufficient coverage to begin scoring.
 */
export function isDimensionScorable(dimension: OrxDimensionDomain): boolean {
  const coverages = ORX_COVERAGE_BASELINE.filter(c => c.dimension === dimension);
  if (coverages.length === 0) return false;
  return coverages.every(c => c.coverage_score >= c.scoring_threshold && !c.sparsity_flag);
}

/**
 * Get coverage report for a dimension.
 */
export function getDimensionCoverage(dimension: OrxDimensionDomain): OrxCoverageMetadata[] {
  return ORX_COVERAGE_BASELINE.filter(c => c.dimension === dimension);
}

/**
 * Get all dimensions that are currently scorable.
 */
export function getScorableDimensions(): OrxDimensionDomain[] {
  const dimensions: OrxDimensionDomain[] = ['core', 'living', 'work_mobility', 'roi', 'fit'];
  return dimensions.filter(isDimensionScorable);
}
