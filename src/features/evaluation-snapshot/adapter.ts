// ═══════════════════════════════════════════════════════════════
// Adapter: Door 3 analyses + canonical citizenship → normalizer input
// ───────────────────────────────────────────────────────────────
// Pure utility. Takes the document analyses produced by the live
// pipeline and shapes them into EvaluationDocInput[] for the
// Phase A source-side normalizer.
// ═══════════════════════════════════════════════════════════════

import type { DocumentAnalysis } from '@/features/documents/document-analysis-model';
import type { SourceCountryCode } from '@/features/source-normalization/types';
import type { EvaluationDocInput } from '@/hooks/useStudentEvaluation';

const COUNTRY_TO_PHASE_A: Record<string, SourceCountryCode> = {
  EG: 'EG',
  AE: 'AE',
  JO: 'JO',
};

function getField(a: DocumentAnalysis, key: string): string | null {
  const f = a.extracted_fields?.[key];
  if (!f) return null;
  return f.value != null ? String(f.value) : null;
}

function inferCountry(
  a: DocumentAnalysis,
  citizenshipCountry: string | null | undefined,
): SourceCountryCode | null {
  // Heuristic: the awarding country is most likely the student's citizenship.
  // Phase A only knows EG / AE / JO — anything else returns null.
  if (citizenshipCountry && COUNTRY_TO_PHASE_A[citizenshipCountry.toUpperCase()]) {
    return COUNTRY_TO_PHASE_A[citizenshipCountry.toUpperCase()];
  }
  // Fallback: scan the institution / cert title for country hints (Arabic / English).
  const hay = [
    getField(a, 'institution_name'),
    getField(a, 'certificate_title'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/مصر|egypt|الثانوية العامة|thanaweya/i.test(hay)) return 'EG';
  if (/الإمارات|emirates|uae|moe\s*secondary/i.test(hay)) return 'AE';
  if (/الأردن|jordan|tawjihi|توجيهي/i.test(hay)) return 'JO';
  return null;
}

export interface AnalysisToEvalInputOptions {
  /** ISO-2 citizenship country from the canonical file, if known. */
  citizenshipCountry?: string | null;
}

/**
 * Convert a list of completed certificate analyses into EvaluationDocInput[].
 * Skips analyses that aren't certificates / transcripts or aren't completed.
 */
export function analysesToEvalInputs(
  analyses: DocumentAnalysis[],
  opts: AnalysisToEvalInputOptions = {},
): EvaluationDocInput[] {
  const out: EvaluationDocInput[] = [];
  for (const a of analyses) {
    if (a.analysis_status !== 'completed') continue;
    if (
      a.classification_result !== 'graduation_certificate' &&
      a.classification_result !== 'transcript' &&
      a.classification_result !== 'language_certificate'
    ) {
      continue;
    }
    const award_name_raw =
      getField(a, 'certificate_title') ??
      getField(a, 'language_test_name') ??
      getField(a, 'institution_name') ??
      '';
    const award_year_raw =
      getField(a, 'graduation_year') ??
      getField(a, 'issue_date') ??
      null;
    const award_year =
      award_year_raw && /\d{4}/.test(award_year_raw)
        ? parseInt(award_year_raw.match(/\d{4}/)![0], 10)
        : null;
    const award_score_raw = getField(a, 'score');
    const award_grade_raw = getField(a, 'grade');

    out.push({
      document_id: a.document_id,
      source_country: inferCountry(a, opts.citizenshipCountry),
      award_name_raw,
      award_year,
      award_grade_raw,
      award_score_raw,
      // Use updated_at as a stable content fingerprint — changes only when
      // the analysis itself is rewritten (i.e. when the doc is re-analyzed).
      content_hash: a.updated_at ?? null,
    });
  }
  return out;
}
