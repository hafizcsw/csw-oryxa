/**
 * ORX Source Policy Enforcement — Validation layer
 *
 * Enforces the source governance policy matrix when ingesting
 * ORX 2.0 dimension facts. Prevents invalid source/domain/boundary
 * combinations from being stored.
 */

import {
  type OrxSourceFamily,
  type OrxDimensionDomain,
  type OrxFactBoundary,
  getSourcePolicy,
  isSourceAllowedForDomain,
  isSourceAllowedForBoundary,
} from '@/types/orxSourceGovernance';
import { type OrxDimensionFactInsert, getDomainForFamily, isValidFactFamily } from '@/types/orxDimensionFacts';

// ── Validation result ──

export interface PolicyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a dimension fact insert against source governance policy.
 * Returns validation result with specific error/warning messages.
 */
export function validateFactAgainstPolicy(fact: OrxDimensionFactInsert): PolicyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check fact family is valid
  if (!isValidFactFamily(fact.fact_family)) {
    errors.push(`Unknown fact_family: "${fact.fact_family}". Must be a registered ORX 2.0 family.`);
  }

  // 2. Check dimension domain matches fact family
  const expectedDomain = getDomainForFamily(fact.fact_family);
  if (expectedDomain && expectedDomain !== fact.dimension_domain) {
    errors.push(
      `Dimension mismatch: fact_family "${fact.fact_family}" belongs to "${expectedDomain}" but dimension_domain is "${fact.dimension_domain}".`
    );
  }

  // 3. Check source family exists in policy matrix
  const sourceFamily = fact.source_family as OrxSourceFamily;
  const policy = getSourcePolicy(sourceFamily);
  if (!policy) {
    errors.push(`Unknown source_family: "${fact.source_family}". No governance policy found.`);
    return { valid: false, errors, warnings };
  }

  // 4. Check source is allowed for this dimension domain
  if (!isSourceAllowedForDomain(sourceFamily, fact.dimension_domain)) {
    errors.push(
      `Source "${fact.source_family}" is not allowed for dimension "${fact.dimension_domain}". ` +
      `Allowed domains: ${policy.allowed_domains.join(', ')}.`
    );
  }

  // 5. Check source is allowed for this boundary
  if (!isSourceAllowedForBoundary(sourceFamily, fact.boundary_type)) {
    errors.push(
      `Source "${fact.source_family}" is not allowed for boundary "${fact.boundary_type}". ` +
      `Allowed boundaries: ${policy.fact_boundaries.join(', ')}.`
    );
  }

  // 6. Contextual-only warning
  if (policy.contextual_only) {
    warnings.push(
      `Source "${fact.source_family}" is contextual-only. This fact cannot be the sole basis for scoring.`
    );
  }

  // 7. Freshness check
  if (fact.freshness_date) {
    const freshnessDate = new Date(fact.freshness_date);
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - freshnessDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > policy.freshness_window_days) {
      warnings.push(
        `Fact freshness date is ${daysSince} days old, exceeding the ${policy.freshness_window_days}-day window for "${fact.source_family}".`
      );
    }
  }

  // 8. Confidence range check
  if (fact.confidence != null && (fact.confidence < 0 || fact.confidence > 100)) {
    errors.push(`Confidence must be 0-100, got ${fact.confidence}.`);
  }

  // 9. Coverage/comparability range check
  if (fact.coverage_score != null && (fact.coverage_score < 0 || fact.coverage_score > 100)) {
    errors.push(`Coverage score must be 0-100, got ${fact.coverage_score}.`);
  }
  if (fact.comparability_score != null && (fact.comparability_score < 0 || fact.comparability_score > 100)) {
    errors.push(`Comparability score must be 0-100, got ${fact.comparability_score}.`);
  }

  // 10. Status must not be 'published' on initial insert (internal-first)
  if (fact.status === 'published') {
    errors.push('Cannot directly insert as "published". Facts must go through candidate → internal_approved → published lifecycle.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Apply confidence modifier from source policy.
 */
export function applyConfidenceModifier(
  baseConfidence: number,
  sourceFamily: OrxSourceFamily
): number {
  const policy = getSourcePolicy(sourceFamily);
  if (!policy) return baseConfidence;
  const modified = baseConfidence + (policy.confidence_modifier * 100);
  return Math.max(0, Math.min(100, Math.round(modified)));
}
