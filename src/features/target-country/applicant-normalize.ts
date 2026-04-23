// ═══════════════════════════════════════════════════════════════
// Door 2 — Applicant normalization (canonical → engine input)
// ═══════════════════════════════════════════════════════════════
// Pure mapping. Reads ONLY from CanonicalStudentFile baseline
// (Door 1 truth) — no localStorage, no other source.
// ═══════════════════════════════════════════════════════════════
import type { CanonicalStudentFile } from '@/features/student-file/canonical-model';

export interface ApplicantTruth {
  student_id: string;
  citizenship: string | null;
  secondary_completed: boolean;
  secondary_kind: 'general' | 'vocational' | 'technical' | 'diploma' | null;
  secondary_grade_pct: number | null;     // 0..100
  english_test_type: string | null;       // ielts | toefl | duolingo | pte | none | null
  english_total_score: number | null;
  english_medium_secondary: boolean;      // exemption signal
  majority_english_country: boolean;      // exemption signal
  local_language_signals: string[];       // ISO codes student likely already has
}

const ENGLISH_MAJORITY_COUNTRIES = new Set([
  'US', 'GB', 'CA', 'AU', 'NZ', 'IE',
]);

function inferGradePct(c: CanonicalStudentFile): number | null {
  const { gpa_normalized, gpa_raw, grading_scale } = c.academic;
  if (gpa_normalized != null && gpa_normalized > 0) {
    // gpa_normalized is on 0..4.0 per canonical model
    return Math.round((gpa_normalized / 4) * 100);
  }
  if (gpa_raw != null) {
    const n = parseFloat(gpa_raw);
    if (!isNaN(n)) {
      if (grading_scale === '100' || grading_scale === 'percentage') return n;
      if (grading_scale === '5' || grading_scale === '5.0') return Math.round((n / 5) * 100);
      if (grading_scale === '4' || grading_scale === '4.0') return Math.round((n / 4) * 100);
      if (n <= 4.0) return Math.round((n / 4) * 100);
      if (n <= 5.0) return Math.round((n / 5) * 100);
      if (n <= 100) return Math.round(n);
    }
  }
  return null;
}

function inferSecondaryKind(c: CanonicalStudentFile): ApplicantTruth['secondary_kind'] {
  const raw = (c.academic.last_education_level || c.academic.current_study_level || '').toLowerCase();
  if (!raw) return null;
  if (/vocational|vocation/.test(raw)) return 'vocational';
  if (/technical|tech/.test(raw)) return 'technical';
  if (/diploma/.test(raw)) return 'diploma';
  if (/secondary|high\s*school|tawjihi|baccalaur|ثانوي|توجيه|ثانوية/.test(raw)) return 'general';
  return null;
}

function inferSecondaryCompleted(c: CanonicalStudentFile): boolean {
  if (c.academic.graduation_year != null) return true;
  if (c.academic.degree_conferral_date != null) return true;
  const lvl = (c.academic.last_education_level || '').toLowerCase();
  return /secondary|diploma|baccalaur|tawjihi|ثانوي/.test(lvl);
}

export function buildApplicantTruth(c: CanonicalStudentFile): ApplicantTruth {
  const citizenship = c.identity.citizenship;
  const englishMajority = !!citizenship && ENGLISH_MAJORITY_COUNTRIES.has(citizenship.toUpperCase());

  return {
    student_id: c.student_id,
    citizenship,
    secondary_completed: inferSecondaryCompleted(c),
    secondary_kind: inferSecondaryKind(c),
    secondary_grade_pct: inferGradePct(c),
    english_test_type: c.language.english_test_type,
    english_total_score: c.language.english_total_score,
    english_medium_secondary: false, // not yet captured in canonical; placeholder signal
    majority_english_country: englishMajority,
    local_language_signals: [], // not captured in canonical baseline
  };
}
