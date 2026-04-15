/**
 * ORX Evidence Registry — Type definitions & contract
 *
 * Typed layer for the orx_evidence table.
 * Consumed by future crawlers, extractors, and scoring engine.
 */

import type { OrxEntityType } from './orx';

// ── Enums (match Postgres enums exactly) ──

export type OrxEvidenceStatus =
  | 'discovered'
  | 'fetched'
  | 'extracted'
  | 'normalized'
  | 'accepted'
  | 'rejected'
  | 'stale'
  | 'superseded'
  | 'conflicted';

export type OrxTrustLevel = 'high' | 'medium' | 'low';

export type OrxSourceType =
  | 'official_website'
  | 'course_catalog'
  | 'official_pdf'
  | 'structured_data'
  | 'government_report'
  | 'accreditation_body'
  | 'verified_student'
  | 'third_party_index'
  | 'news_press';

export type OrxLayer = 'country' | 'university' | 'program';

// ── DB row type (mirrors orx_evidence table 1:1) ──

export interface OrxEvidenceRow {
  id: string;
  entity_type: OrxEntityType;
  entity_id: string;
  layer: OrxLayer;
  signal_family: string;

  source_type: OrxSourceType;
  source_url: string;
  source_domain: string;
  source_title: string | null;
  trust_level: OrxTrustLevel;
  contextual_only: boolean;

  snippet: string | null;
  language_code: string | null;
  content_hash: string;

  observed_at: string;
  freshness_date: string | null;

  evidence_status: OrxEvidenceStatus;
  extraction_confidence: number | null;
  rejection_reason: string | null;

  conflict_group_id: string | null;
  methodology_version: string;

  created_at: string;
  updated_at: string;
}

// ── Insert shape (for ingestion pipeline) ──

export interface OrxEvidenceInsert {
  entity_type: OrxEntityType;
  entity_id: string;
  layer: OrxLayer;
  signal_family: string;

  source_type: OrxSourceType;
  source_url: string;
  source_domain: string;
  source_title?: string | null;
  trust_level: OrxTrustLevel;
  contextual_only?: boolean;

  snippet?: string | null;
  language_code?: string | null;
  content_hash: string;

  observed_at?: string;
  freshness_date?: string | null;

  evidence_status?: OrxEvidenceStatus;
  extraction_confidence?: number | null;
  rejection_reason?: string | null;

  conflict_group_id?: string | null;
  methodology_version?: string;
}

// ── Pipeline state machine ──

/**
 * Valid state transitions for evidence items.
 * Enforced at application level, not DB constraint.
 */
export const ORX_EVIDENCE_TRANSITIONS: Record<OrxEvidenceStatus, OrxEvidenceStatus[]> = {
  discovered:  ['fetched', 'rejected'],
  fetched:     ['extracted', 'rejected'],
  extracted:   ['normalized', 'rejected'],
  normalized:  ['accepted', 'rejected', 'conflicted'],
  accepted:    ['stale', 'superseded'],
  rejected:    [],  // terminal
  stale:       ['accepted', 'superseded'],  // re-fetch can revive
  superseded:  [],  // terminal
  conflicted:  ['accepted', 'rejected'],  // after resolution
};

/**
 * Check if a state transition is valid.
 */
export function isValidEvidenceTransition(
  from: OrxEvidenceStatus,
  to: OrxEvidenceStatus
): boolean {
  return ORX_EVIDENCE_TRANSITIONS[from].includes(to);
}

// ── Source type metadata ──

export interface SourceTypeMeta {
  type: OrxSourceType;
  trust_level: OrxTrustLevel;
  contextual_only: boolean;
}

export const ORX_SOURCE_TYPE_META: SourceTypeMeta[] = [
  { type: 'official_website',   trust_level: 'high',   contextual_only: false },
  { type: 'course_catalog',     trust_level: 'high',   contextual_only: false },
  { type: 'official_pdf',       trust_level: 'high',   contextual_only: false },
  { type: 'structured_data',    trust_level: 'high',   contextual_only: false },
  { type: 'government_report',  trust_level: 'high',   contextual_only: false },
  { type: 'accreditation_body', trust_level: 'high',   contextual_only: false },
  { type: 'verified_student',   trust_level: 'medium', contextual_only: false },
  { type: 'third_party_index',  trust_level: 'medium', contextual_only: true },
  { type: 'news_press',         trust_level: 'low',    contextual_only: true },
];

/**
 * Get default trust level and contextual flag for a source type.
 */
export function getSourceTypeMeta(type: OrxSourceType): SourceTypeMeta {
  return ORX_SOURCE_TYPE_META.find(s => s.type === type)!;
}

// ── Dedupe helpers ──

/**
 * Extract registrable domain from a URL for source independence.
 * Simple extraction — production may use a proper public suffix list.
 */
export function extractRegistrableDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    // Handle common patterns: foo.bar.edu → bar.edu, foo.co.uk → foo.co.uk
    if (parts.length <= 2) return hostname;
    // Simple heuristic: take last 2 parts unless TLD is 2-char (co.uk etc.)
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    if (sld.length <= 3 && tld.length <= 3) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  } catch {
    return url;
  }
}
