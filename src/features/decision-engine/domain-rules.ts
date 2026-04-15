// ═══════════════════════════════════════════════════════════════
// Domain Rules — Door 5: Domain bucket evaluation
// ═══════════════════════════════════════════════════════════════
// Readable rules for each domain bucket.
// No hidden magic. Each rule is explicit and auditable.
// ═══════════════════════════════════════════════════════════════

import type { AcademicTruth } from '../academic-truth/types';
import type { CanonicalLanguage } from '../student-file/canonical-model';
import type { DomainDecision, DomainBucket, DecisionReason } from './types';

function r(code: string, labelKey: string, detail?: string): DecisionReason {
  return { code, label_key: labelKey, detail };
}

/**
 * Evaluate all domain buckets against student's academic truth.
 * Returns DomainDecision[] — one per bucket.
 *
 * Rules are intentionally readable:
 *   medicine = biology + chemistry + language + high competitiveness
 *   engineering = math + physics + language
 *   computer_science = math + language + background fit
 *   business = overall academic + language (less strict prerequisites)
 *   general_science = broad science readiness
 */
export function evaluateDomains(
  academic: AcademicTruth,
  lang: CanonicalLanguage | null | undefined,
  gpa4: number | null,
): DomainDecision[] {
  return [
    evaluateMedicine(academic, lang, gpa4),
    evaluateEngineering(academic, lang, gpa4),
    evaluateComputerScience(academic, lang, gpa4),
    evaluateBusiness(academic, lang, gpa4),
    evaluateGeneralScience(academic, lang, gpa4),
  ];
}

// ── Medicine ─────────────────────────────────────────────────
// Requires: biology + chemistry + strong language + high GPA

function evaluateMedicine(
  acad: AcademicTruth,
  lang: CanonicalLanguage | null | undefined,
  gpa4: number | null,
): DomainDecision {
  const reasons: DecisionReason[] = [];
  let score = 0;
  const needed = 4;

  const hasBio = acad.subject_families_present.includes('biology');
  const hasChem = acad.subject_families_present.includes('chemistry');
  const hasLang = langScore(lang) >= 6.0;
  const highGpa = gpa4 != null && gpa4 >= 3.3;

  if (hasBio) { score++; reasons.push(r('has_biology', 'decision.domain.has_biology')); }
  else reasons.push(r('missing_biology', 'decision.domain.missing_biology'));

  if (hasChem) { score++; reasons.push(r('has_chemistry', 'decision.domain.has_chemistry')); }
  else reasons.push(r('missing_chemistry', 'decision.domain.missing_chemistry'));

  if (hasLang) { score++; reasons.push(r('lang_ok', 'decision.domain.language_sufficient')); }
  else reasons.push(r('lang_weak', 'decision.domain.language_insufficient'));

  if (highGpa) { score++; reasons.push(r('high_gpa', 'decision.domain.high_gpa')); }
  else if (gpa4 != null) reasons.push(r('gpa_low', 'decision.domain.gpa_below_competitive'));

  return {
    domain: 'medicine',
    status: score >= needed ? 'candidate' : score >= 2 ? 'maybe' : 'rejected',
    reasons,
  };
}

// ── Engineering ──────────────────────────────────────────────
// Requires: math + physics + language

function evaluateEngineering(
  acad: AcademicTruth,
  lang: CanonicalLanguage | null | undefined,
  gpa4: number | null,
): DomainDecision {
  const reasons: DecisionReason[] = [];
  let score = 0;

  if (acad.has_math) { score++; reasons.push(r('has_math', 'decision.domain.has_math')); }
  else reasons.push(r('missing_math', 'decision.domain.missing_math'));

  if (acad.subject_families_present.includes('physics')) { score++; reasons.push(r('has_physics', 'decision.domain.has_physics')); }
  else reasons.push(r('missing_physics', 'decision.domain.missing_physics'));

  if (langScore(lang) >= 5.5) { score++; reasons.push(r('lang_ok', 'decision.domain.language_sufficient')); }
  else reasons.push(r('lang_weak', 'decision.domain.language_insufficient'));

  return {
    domain: 'engineering',
    status: score >= 3 ? 'candidate' : score >= 2 ? 'maybe' : 'rejected',
    reasons,
  };
}

// ── Computer Science ─────────────────────────────────────────
// Requires: math + language + background fit

function evaluateComputerScience(
  acad: AcademicTruth,
  lang: CanonicalLanguage | null | undefined,
  gpa4: number | null,
): DomainDecision {
  const reasons: DecisionReason[] = [];
  let score = 0;

  if (acad.has_math) { score++; reasons.push(r('has_math', 'decision.domain.has_math')); }
  else reasons.push(r('missing_math', 'decision.domain.missing_math'));

  if (langScore(lang) >= 5.5) { score++; reasons.push(r('lang_ok', 'decision.domain.language_sufficient')); }
  else reasons.push(r('lang_weak', 'decision.domain.language_insufficient'));

  if (acad.subject_families_present.includes('computer_science')) {
    score++;
    reasons.push(r('has_cs', 'decision.domain.has_cs_background'));
  }

  // Math + any science is also acceptable
  if (acad.has_science_subjects) {
    score++;
    reasons.push(r('has_science', 'decision.domain.has_science_background'));
  }

  return {
    domain: 'computer_science',
    status: score >= 3 ? 'candidate' : score >= 2 ? 'maybe' : 'rejected',
    reasons,
  };
}

// ── Business ─────────────────────────────────────────────────
// Relies on overall academic strength + language, less strict prerequisites

function evaluateBusiness(
  acad: AcademicTruth,
  lang: CanonicalLanguage | null | undefined,
  gpa4: number | null,
): DomainDecision {
  const reasons: DecisionReason[] = [];
  let score = 0;

  if (gpa4 != null && gpa4 >= 2.5) { score++; reasons.push(r('gpa_ok', 'decision.domain.gpa_sufficient')); }
  else if (gpa4 != null) reasons.push(r('gpa_low', 'decision.domain.gpa_below_competitive'));

  if (langScore(lang) >= 5.5) { score++; reasons.push(r('lang_ok', 'decision.domain.language_sufficient')); }
  else reasons.push(r('lang_weak', 'decision.domain.language_insufficient'));

  // Any academic credential is sufficient
  if (acad.last_education_level || acad.credential_type) { score++; reasons.push(r('has_credential', 'decision.domain.has_credential')); }

  // Business/economics background is a bonus
  if (acad.subject_families_present.includes('business') || acad.subject_families_present.includes('economics')) {
    score++;
    reasons.push(r('has_business_bg', 'decision.domain.has_business_background'));
  }

  return {
    domain: 'business',
    status: score >= 3 ? 'candidate' : score >= 2 ? 'maybe' : 'rejected',
    reasons,
  };
}

// ── General Science ──────────────────────────────────────────
// Broad science readiness

function evaluateGeneralScience(
  acad: AcademicTruth,
  lang: CanonicalLanguage | null | undefined,
  gpa4: number | null,
): DomainDecision {
  const reasons: DecisionReason[] = [];
  let score = 0;

  if (acad.has_science_subjects) { score++; reasons.push(r('has_science', 'decision.domain.has_science_background')); }
  else reasons.push(r('no_science', 'decision.domain.no_science_subjects'));

  if (acad.has_math) { score++; reasons.push(r('has_math', 'decision.domain.has_math')); }

  if (langScore(lang) >= 5.5) { score++; reasons.push(r('lang_ok', 'decision.domain.language_sufficient')); }
  else reasons.push(r('lang_weak', 'decision.domain.language_insufficient'));

  if (gpa4 != null && gpa4 >= 2.5) { score++; }

  return {
    domain: 'general_science',
    status: score >= 3 ? 'candidate' : score >= 2 ? 'maybe' : 'rejected',
    reasons,
  };
}

// ── Language score helper ────────────────────────────────────

function langScore(lang: CanonicalLanguage | null | undefined): number {
  if (!lang?.english_total_score) return 0;
  const t = lang.english_test_type;
  const s = lang.english_total_score;

  // Normalize to IELTS-equivalent scale for comparison
  if (t === 'toefl') return s >= 100 ? 7.5 : s >= 90 ? 7.0 : s >= 80 ? 6.5 : s >= 60 ? 5.5 : 4.0;
  if (t === 'duolingo') return s >= 120 ? 7.0 : s >= 105 ? 6.5 : s >= 90 ? 6.0 : s >= 75 ? 5.5 : 4.0;
  if (t === 'pte' || t === 'pte_academic') return s >= 76 ? 7.5 : s >= 65 ? 7.0 : s >= 58 ? 6.5 : s >= 50 ? 6.0 : 4.0;
  // Default: treat as IELTS scale
  return s;
}
