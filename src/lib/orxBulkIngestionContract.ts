/**
 * ORX 2.0 Bulk Ingestion Contract — Adapter-ready input specification
 *
 * Defines the contract that future source adapters / crawlers must conform to
 * when submitting batches of dimension facts to the ORX 2.0 pipeline.
 *
 * Does NOT implement crawlers. Only defines the contract.
 */

import type { OrxSourceFamily, OrxDimensionDomain, OrxFactBoundary } from '@/types/orxSourceGovernance';

// ── Batch payload contract ──

export interface OrxIngestionBatch {
  /** Unique identifier for this batch run */
  batch_id: string;

  /** Source adapter identifier */
  adapter_id: string;

  /** Source family for all facts in this batch */
  source_family: OrxSourceFamily;

  /** Dimension domain for all facts */
  domain: OrxDimensionDomain;

  /** Boundary type for all facts */
  boundary: OrxFactBoundary;

  /** ISO timestamp of extraction */
  extracted_at: string;

  /** Methodology version */
  methodology_version: string;

  /** Individual facts */
  facts: OrxIngestionRecord[];

  /** Optional metadata about the source run */
  source_metadata?: {
    source_url?: string;
    source_domain?: string;
    extraction_method?: string;
    pages_processed?: number;
    raw_record_count?: number;
  };
}

export interface OrxIngestionRecord {
  /** Entity mapping */
  entity_type: string;
  entity_id: string;

  /** Fact classification */
  fact_family: string;
  fact_key: string;

  /** Extracted payload */
  fact_value: Record<string, unknown>;
  display_text?: string | null;

  /** Quality metadata */
  confidence?: number;
  coverage_score?: number;
  comparability_score?: number;
  sparsity_flag?: boolean;
  regional_bias_flag?: boolean;

  /** Source provenance */
  source_url?: string;
  source_domain?: string;
  source_type?: string;
  freshness_date?: string;
}

/**
 * Transform a batch into the ingestion API payload format.
 */
export function batchToApiPayload(batch: OrxIngestionBatch): {
  facts: Array<Record<string, unknown>>;
} {
  return {
    facts: batch.facts.map(f => ({
      boundary_type: batch.boundary,
      entity_type: f.entity_type,
      entity_id: f.entity_id,
      dimension_domain: batch.domain,
      fact_family: f.fact_family,
      fact_key: f.fact_key,
      fact_value: f.fact_value,
      display_text: f.display_text ?? null,
      source_url: f.source_url ?? batch.source_metadata?.source_url ?? null,
      source_domain: f.source_domain ?? batch.source_metadata?.source_domain ?? null,
      source_family: batch.source_family,
      source_type: f.source_type ?? null,
      confidence: f.confidence ?? null,
      coverage_score: f.coverage_score ?? null,
      comparability_score: f.comparability_score ?? null,
      sparsity_flag: f.sparsity_flag ?? false,
      regional_bias_flag: f.regional_bias_flag ?? false,
      freshness_date: f.freshness_date ?? batch.extracted_at,
      status: 'candidate',
      methodology_version: batch.methodology_version,
    })),
  };
}

/**
 * Validate a batch before submission.
 */
export function validateBatch(batch: OrxIngestionBatch): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!batch.batch_id) errors.push('Missing batch_id');
  if (!batch.adapter_id) errors.push('Missing adapter_id');
  if (!batch.source_family) errors.push('Missing source_family');
  if (!batch.domain) errors.push('Missing domain');
  if (!batch.boundary) errors.push('Missing boundary');
  if (!batch.facts || batch.facts.length === 0) errors.push('Empty facts array');
  if (batch.facts && batch.facts.length > 500) errors.push('Max 500 facts per batch');

  for (let i = 0; i < (batch.facts?.length ?? 0); i++) {
    const f = batch.facts[i];
    if (!f.entity_type || !f.entity_id) errors.push(`Fact[${i}]: missing entity mapping`);
    if (!f.fact_family || !f.fact_key) errors.push(`Fact[${i}]: missing fact classification`);
  }

  return { valid: errors.length === 0, errors };
}
