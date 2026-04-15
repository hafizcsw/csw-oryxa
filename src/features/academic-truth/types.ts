// ═══════════════════════════════════════════════════════════════
// Academic Truth Types — Door 4
// ═══════════════════════════════════════════════════════════════
// Extends canonical student file with structured academic truth:
// subject rows, subject families, and study status.
// No external LLM. No OCR for images.
// ═══════════════════════════════════════════════════════════════

// ── Subject Families V1 ──────────────────────────────────────

export const SUBJECT_FAMILIES = [
  'chemistry',
  'biology',
  'physics',
  'mathematics',
  'english',
  'computer_science',
  'economics',
  'business',
  'social_science',
  'other',
] as const;

export type SubjectFamily = typeof SUBJECT_FAMILIES[number];

// ── Study Status ─────────────────────────────────────────────

export type StudyStatus =
  | 'enrolled'
  | 'graduated'
  | 'completed'
  | 'withdrawn'
  | 'dismissed'
  | 'unknown';

// ── Subject Row ──────────────────────────────────────────────

export interface SubjectRow {
  row_id: string;
  student_id: string;
  source_document_id: string | null;
  subject_raw_name: string;
  subject_canonical_name: string | null;
  subject_family: SubjectFamily;
  grade_raw: string | null;
  grade_normalized: number | null;   // 0–100 scale
  credits: number | null;
  level: string | null;              // e.g. "A-Level", "AP", "standard"
  year_or_term: string | null;
  passed: boolean | null;
  confidence: number;                // 0.0–1.0
}

// ── Academic Truth Snapshot ──────────────────────────────────
// Built from CanonicalStudentFile.academic + extracted subject rows.

export interface AcademicTruth {
  // From canonical academic block
  current_education_level: string | null;
  last_education_level: string | null;
  credential_name: string | null;
  credential_type: string | null;
  awarding_institution: string | null;
  institution_name: string | null;
  graduation_year: number | null;
  degree_conferral_date: string | null;
  gpa_raw: string | null;
  gpa_normalized: number | null;
  grading_scale: string | null;
  country_of_education: string | null;
  study_status: StudyStatus;
  transcript_language: string | null;

  // Subject rows
  subject_rows: SubjectRow[];

  // Computed summaries
  has_science_subjects: boolean;
  has_math: boolean;
  has_english: boolean;
  subject_families_present: SubjectFamily[];
  total_credits: number | null;
}

// ── Subject family normalization map ─────────────────────────

const FAMILY_KEYWORDS: Record<SubjectFamily, RegExp[]> = {
  chemistry: [/chem/i, /كيمياء/],
  biology: [/bio/i, /أحياء/, /احياء/],
  physics: [/phys/i, /فيزياء/],
  mathematics: [/math/i, /calculus/i, /algebra/i, /statistics/i, /رياضيات/],
  english: [/english/i, /إنجليزي/, /انجليزي/, /لغة\s*إنجليزية/],
  computer_science: [/computer/i, /programming/i, /حاسب/, /حاسوب/, /برمجة/],
  economics: [/econom/i, /اقتصاد/],
  business: [/business/i, /management/i, /accounting/i, /إدارة/, /محاسبة/],
  social_science: [/social/i, /history/i, /geography/i, /psycholog/i, /sociol/i, /اجتماع/, /تاريخ/, /جغرافيا/],
  other: [],
};

export function normalizeSubjectFamily(rawName: string): SubjectFamily {
  const lower = rawName.toLowerCase().trim();
  for (const [family, patterns] of Object.entries(FAMILY_KEYWORDS) as [SubjectFamily, RegExp[]][]) {
    if (family === 'other') continue;
    for (const p of patterns) {
      if (p.test(lower)) return family;
    }
  }
  return 'other';
}

// ── Grade normalization ──────────────────────────────────────

export function normalizeGradeTo100(raw: string, scale?: string): number | null {
  const num = parseFloat(raw);
  if (isNaN(num)) {
    // Letter grades
    const letterMap: Record<string, number> = {
      'a+': 97, 'a': 93, 'a-': 90,
      'b+': 87, 'b': 83, 'b-': 80,
      'c+': 77, 'c': 73, 'c-': 70,
      'd+': 67, 'd': 63, 'd-': 60,
      'f': 40, 'e': 50,
    };
    return letterMap[raw.toLowerCase().trim()] ?? null;
  }

  if (scale === '4' || scale === '4.0') return (num / 4) * 100;
  if (scale === '5' || scale === '5.0') return (num / 5) * 100;
  if (num <= 4.0 && !scale) return (num / 4) * 100;
  if (num <= 5.0 && !scale) return (num / 5) * 100;
  if (num <= 100) return num;
  return null;
}
