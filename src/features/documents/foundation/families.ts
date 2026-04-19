// ═══════════════════════════════════════════════════════════════
// Foundation — Document Families (official taxonomy, V1)
// ═══════════════════════════════════════════════════════════════
// THE ONLY families this system officially recognizes.
// Anything that does not match with confidence MUST become
// 'unknown_document' and route to needs_review.
// No silent reclassification. No hallucinated families.
// ═══════════════════════════════════════════════════════════════

export type DocumentFamily =
  | 'passport_id'
  | 'graduation_certificate'
  | 'language_certificate'
  | 'academic_transcript'
  | 'unknown_document'
  | 'composite_document';

export const ALL_FAMILIES: DocumentFamily[] = [
  'passport_id',
  'graduation_certificate',
  'language_certificate',
  'academic_transcript',
  'unknown_document',
  'composite_document',
];

export function isKnownFamily(f: string): f is DocumentFamily {
  return (ALL_FAMILIES as string[]).includes(f);
}

/** The lane each family is allowed to flow into. Foundation only — no extraction here. */
export type ProcessingLane =
  | 'passport_lane'
  | 'graduation_lane'
  | 'language_lane'
  | 'transcript_lane'
  | 'review_lane'
  | 'composite_lane';

export function defaultLaneFor(family: DocumentFamily): ProcessingLane {
  switch (family) {
    case 'passport_id': return 'passport_lane';
    case 'graduation_certificate': return 'graduation_lane';
    case 'language_certificate': return 'language_lane';
    case 'academic_transcript': return 'transcript_lane';
    case 'composite_document': return 'composite_lane';
    case 'unknown_document':
    default: return 'review_lane';
  }
}
