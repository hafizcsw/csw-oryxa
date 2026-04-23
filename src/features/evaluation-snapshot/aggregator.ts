// ═══════════════════════════════════════════════════════════════
// Aggregator: per-document normalized credentials → student snapshot
// Pure function. No I/O. No side effects.
// ═══════════════════════════════════════════════════════════════

import type { NormalizerReasonCode } from '@/features/source-normalization/types';
import type {
  EvaluationSnapshotResult,
  PersistedNormalizedCredential,
} from './types';

/** Build a short human-readable summary line for one credential. */
function summarize(c: PersistedNormalizedCredential): string {
  const parts: string[] = [];
  if (c.normalized_credential_subtype) parts.push(c.normalized_credential_subtype);
  else if (c.normalized_credential_kind) parts.push(c.normalized_credential_kind);
  if (c.normalized_grade_pct != null) parts.push(`${c.normalized_grade_pct}%`);
  if (c.award_year) parts.push(String(c.award_year));
  if (c.source_country) parts.push(`(${c.source_country})`);
  return parts.length > 0 ? parts.join(' · ') : 'unrecognized';
}

/** Reason codes from a credential's decision log (excluding success codes). */
function extractReasonCodes(c: PersistedNormalizedCredential): NormalizerReasonCode[] {
  const codes = c.decisions.map((d) => d.reason_code);
  return Array.from(
    new Set(codes.filter((c) => c !== 'pattern_matched' && c !== 'grade_normalized')),
  );
}

/** Pick the headline credential — highest grade among non-review, else first reviewed. */
function pickHeadline(
  credentials: PersistedNormalizedCredential[],
): EvaluationSnapshotResult['headline_credential'] {
  if (credentials.length === 0) return null;
  const passing = credentials.filter((c) => !c.needs_manual_review && c.normalized_grade_pct != null);
  const pool = passing.length > 0 ? passing : credentials;
  const headline = [...pool].sort((a, b) => {
    const ga = a.normalized_grade_pct ?? -1;
    const gb = b.normalized_grade_pct ?? -1;
    return gb - ga;
  })[0];
  return {
    document_id: headline.document_id,
    kind: headline.normalized_credential_kind,
    subtype: headline.normalized_credential_subtype,
    grade_pct: headline.normalized_grade_pct,
    source_country: headline.source_country,
  };
}

export function buildEvaluationSnapshot(
  credentials: PersistedNormalizedCredential[],
): EvaluationSnapshotResult {
  const passing = credentials.filter((c) => !c.needs_manual_review).length;
  const needingReview = credentials.length - passing;

  return {
    documents_evaluated: credentials.length,
    documents_passing: passing,
    documents_needing_review: needingReview,
    per_document: credentials.map((c) => ({
      document_id: c.document_id,
      summary: summarize(c),
      needs_manual_review: c.needs_manual_review,
      reason_codes: extractReasonCodes(c),
    })),
    headline_credential: pickHeadline(credentials),
  };
}
