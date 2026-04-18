// ═══════════════════════════════════════════════════════════════
// assembly-field-templates — Live Profile Assembly templates
// ═══════════════════════════════════════════════════════════════
// Deterministic field-order arrays per destination lane.
// Identity + Language are FIXED templates (always render in order).
// Academic is extraction-driven (this file exposes the EXPECTED set
// so the honesty footer can compute "missing expected" honestly).
//
// Status of a field is NEVER derived from this template — it is
// always derived at runtime from proposals + promotedFields.
// ═══════════════════════════════════════════════════════════════

export type DestinationLane = 'identity' | 'academic' | 'language' | 'needs_review';

export type AcademicSubMode = 'graduation' | 'transcript' | null;

/** Identity (passport) — fixed deterministic 8 fields. */
export const IDENTITY_FIELDS: readonly string[] = [
  'identity.passport_name',
  'identity.passport_number',
  'identity.citizenship',
  'identity.date_of_birth',
  'identity.gender',
  'identity.passport_expiry_date',
  'identity.passport_issuing_country',
  'identity.passport_issue_date',
] as const;

/** Language — fixed deterministic 8 fields. */
export const LANGUAGE_FIELDS: readonly string[] = [
  'language.english_test_type',
  'language.english_total_score',
  'language.english_reading',
  'language.english_writing',
  'language.english_listening',
  'language.english_speaking',
  'language.test_date',
  'language.expiry_date',
] as const;

/** Academic — graduation expected fields (used for honesty metrics only). */
export const ACADEMIC_GRADUATION_EXPECTED: readonly string[] = [
  'academic.credential_name',
  'academic.credential_type',
  'academic.awarding_institution',
  'academic.graduation_year',
  'academic.degree_conferral_date',
  'academic.gpa_raw',
  'academic.gpa_normalized',
  'academic.grading_scale',
] as const;

/** Academic — transcript expected fields (subject rows handled separately). */
export const ACADEMIC_TRANSCRIPT_EXPECTED: readonly string[] = [
  'academic.institution_name',
  'academic.gpa_raw',
  'academic.grading_scale',
  'academic.country_of_education',
  'academic.transcript_language',
] as const;

/** Maximum subject rows to animate before the "+N more" summary. */
export const TRANSCRIPT_ROW_VISIBLE_CAP = 6;

/** Humanize a canonical field key into a short label key suffix. */
export function fieldLabelKey(fieldKey: string): string {
  // "identity.passport_name" -> "portal.assembly.field.identity.passport_name"
  return `portal.assembly.field.${fieldKey}`;
}

/** Confidence threshold below which classification is treated as unresolved. */
export const CLASSIFICATION_CONFIDENCE_MIN = 0.5;

/**
 * Resolve destination lane from analysis classification + confidence.
 * Returns 'needs_review' when classification is unresolved/low-confidence.
 */
export function resolveDestinationLane(
  classification: string | null | undefined,
  confidence: number | null | undefined,
): { lane: DestinationLane; subMode: AcademicSubMode; reason: string | null } {
  const conf = typeof confidence === 'number' ? confidence : 0;
  if (!classification || classification === 'unknown' || classification === 'other') {
    return { lane: 'needs_review', subMode: null, reason: 'classification_uncertain' };
  }
  if (conf < CLASSIFICATION_CONFIDENCE_MIN) {
    return { lane: 'needs_review', subMode: null, reason: 'low_confidence' };
  }
  if (classification === 'passport') return { lane: 'identity', subMode: null, reason: null };
  if (classification === 'transcript') return { lane: 'academic', subMode: 'transcript', reason: null };
  if (classification === 'graduation_certificate') return { lane: 'academic', subMode: 'graduation', reason: null };
  if (classification === 'language_certificate') return { lane: 'language', subMode: null, reason: null };
  return { lane: 'needs_review', subMode: null, reason: 'classification_uncertain' };
}
