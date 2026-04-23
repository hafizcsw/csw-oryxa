// ═══════════════════════════════════════════════════════════════
// Door 2 — Synthetic test fixture (after-secondary applicant)
// ═══════════════════════════════════════════════════════════════
// Used for runtime proof of the 10-country matrix.
// Mirrors a typical Saudi general-secondary graduate with IELTS 6.0.
// ═══════════════════════════════════════════════════════════════
import type { ApplicantTruth } from './applicant-normalize';

export const FIXTURE_APPLICANT: ApplicantTruth = {
  student_id: 'fixture-after-secondary-001',
  citizenship: 'SA',
  secondary_completed: true,
  secondary_kind: 'general',
  secondary_grade_pct: 82,
  english_test_type: 'ielts',
  english_total_score: 6.0,
  english_medium_secondary: false,
  majority_english_country: false,
  local_language_signals: [],
};
