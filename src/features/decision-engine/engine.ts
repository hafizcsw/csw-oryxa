// ═══════════════════════════════════════════════════════════════
// Decision Engine — Door 5
// ═══════════════════════════════════════════════════════════════
// Pure function: AcademicTruth + CanonicalStudentFile + ProgramRequirement[]
// → DecisionResult
// No LLM. No marketing prose. Structured rules only.
// ═══════════════════════════════════════════════════════════════

import type { CanonicalStudentFile } from '../student-file/canonical-model';
import type { AcademicTruth, SubjectFamily } from '../academic-truth/types';
import type { ProgramRequirement } from '../program-requirements/types';
import type {
  DecisionResult,
  DecisionReason,
  Blocker,
  LanguageGap,
  CredentialGap,
  MatchedSubject,
  DomainBucket,
  DomainDecision,
  CompletenessStatus,
  EligibilityStatus,
  FitStatus,
  CompetitivenessStatus,
} from './types';
import { evaluateDomains } from './domain-rules';

// ── GPA normalization to 4.0 scale ──────────────────────────

function gpaTo4(raw: string | null, scale: string | null): number | null {
  if (!raw) return null;
  const num = parseFloat(raw);
  if (isNaN(num)) return null;
  if (scale === '5' || scale === '5.0') return (num / 5) * 4;
  if (scale === '100' || scale === 'percentage') return (num / 100) * 4;
  if (num <= 4) return num;
  if (num <= 5) return (num / 5) * 4;
  if (num <= 100) return (num / 100) * 4;
  return num;
}

// ═══════════════════════════════════════════════════════════════
// MAIN DECISION FUNCTION
// ═══════════════════════════════════════════════════════════════

export function computeDecision(
  canonical: CanonicalStudentFile | null,
  academic: AcademicTruth,
  requirements: ProgramRequirement[],
): DecisionResult {
  const now = new Date().toISOString();
  const blockers: Blocker[] = [];
  const missingRequired: DecisionReason[] = [];
  const eligibilityReasons: DecisionReason[] = [];
  const fitReasons: DecisionReason[] = [];
  const competitiveReasons: DecisionReason[] = [];
  const matchedSubjects: MatchedSubject[] = [];
  const missingSubjects: DecisionReason[] = [];
  const languageGaps: LanguageGap[] = [];
  const credentialGaps: CredentialGap[] = [];

  const lang = canonical?.language;
  const targeting = canonical?.targeting;

  // ════════════════════════════════════════════════════════════
  // A) COMPLETENESS
  // ════════════════════════════════════════════════════════════

  let completenessPoints = 0;
  const totalPoints = 10;

  // Identity
  if (canonical?.identity?.full_name || canonical?.identity?.passport_name) completenessPoints++;
  else missingRequired.push(r('missing_name', 'decision.missing.name'));

  if (canonical?.identity?.citizenship) completenessPoints++;
  else missingRequired.push(r('missing_citizenship', 'decision.missing.citizenship'));

  // Academic
  if (academic.last_education_level || academic.credential_type) completenessPoints++;
  else missingRequired.push(r('missing_education_level', 'decision.missing.education_level'));

  if (academic.gpa_raw) completenessPoints++;
  else missingRequired.push(r('missing_gpa', 'decision.missing.gpa'));

  if (academic.institution_name || academic.awarding_institution) completenessPoints++;
  else missingRequired.push(r('missing_institution', 'decision.missing.institution'));

  // Language
  if (lang?.english_test_type && lang.english_test_type !== 'none') completenessPoints++;
  else missingRequired.push(r('missing_english_test', 'decision.missing.english_test'));

  if (lang?.english_total_score) completenessPoints++;
  else missingRequired.push(r('missing_english_score', 'decision.missing.english_score'));

  // Targeting
  if (targeting?.target_degree) completenessPoints++;
  else missingRequired.push(r('missing_target_degree', 'decision.missing.target_degree'));

  if (targeting?.preferred_majors?.length) completenessPoints++;

  if (targeting?.target_countries?.length) completenessPoints++;

  const completenessScore = Math.round((completenessPoints / totalPoints) * 100);
  const completenessStatus: CompletenessStatus =
    completenessScore >= 80 ? 'complete' :
    completenessScore >= 50 ? 'partial' :
    'insufficient';

  if (completenessStatus === 'insufficient') {
    blockers.push({
      blocker_id: 'completeness_insufficient',
      category: 'completeness',
      label_key: 'decision.blockers.file_incomplete',
      severity: 'blocking',
    });
  }

  // ════════════════════════════════════════════════════════════
  // B) ELIGIBILITY — Check against program requirements
  // ════════════════════════════════════════════════════════════

  const studentGpa4 = academic.gpa_normalized ??
    gpaTo4(academic.gpa_raw, academic.grading_scale);

  let hasBlockingEligibility = false;

  for (const req of requirements) {
    switch (req.requirement_type) {
      case 'overall_grade_minimum': {
        if (req.minimum_overall_grade != null && studentGpa4 != null) {
          if (studentGpa4 < req.minimum_overall_grade) {
            hasBlockingEligibility = true;
            eligibilityReasons.push(r('gpa_below_min', 'decision.eligibility.gpa_below', 
              `${studentGpa4.toFixed(2)} < ${req.minimum_overall_grade}`));
            blockers.push({
              blocker_id: `gpa_${req.requirement_id}`,
              category: 'academic',
              label_key: 'decision.blockers.gpa_below',
              severity: 'blocking',
              detail: `${studentGpa4.toFixed(2)} < ${req.minimum_overall_grade}`,
            });
          } else {
            eligibilityReasons.push(r('gpa_meets', 'decision.eligibility.gpa_meets',
              `${studentGpa4.toFixed(2)} >= ${req.minimum_overall_grade}`));
          }
        } else if (req.minimum_overall_grade != null && studentGpa4 == null) {
          missingRequired.push(r('gpa_needed', 'decision.missing.gpa_for_requirement'));
        }
        break;
      }

      case 'english_minimum': {
        const testType = req.english_test_type;
        const studentTest = lang?.english_test_type;
        const studentScore = lang?.english_total_score;

        if (req.minimum_english_total != null) {
          if (!studentTest || studentTest === 'none' || !studentScore) {
            languageGaps.push({
              test_type: testType ?? 'unknown',
              student_score: null,
              required_score: req.minimum_english_total,
              component: 'overall',
            });
            blockers.push({
              blocker_id: `lang_missing_${req.requirement_id}`,
              category: 'language',
              label_key: 'decision.blockers.language_test_missing',
              severity: 'blocking',
            });
            hasBlockingEligibility = true;
          } else if (testType && studentTest === testType && studentScore < req.minimum_english_total) {
            languageGaps.push({
              test_type: testType,
              student_score: studentScore,
              required_score: req.minimum_english_total,
              component: 'overall',
            });
            blockers.push({
              blocker_id: `lang_below_${req.requirement_id}`,
              category: 'language',
              label_key: 'decision.blockers.language_score_below',
              severity: 'blocking',
              detail: `${studentScore} < ${req.minimum_english_total}`,
            });
            hasBlockingEligibility = true;
          } else if (studentTest === testType && studentScore != null && studentScore >= req.minimum_english_total) {
            eligibilityReasons.push(r('lang_meets', 'decision.eligibility.language_meets',
              `${studentTest}: ${studentScore} >= ${req.minimum_english_total}`));
          }
        }

        // Sub-score checks
        const subChecks: Array<{ comp: string; studentVal: number | null; reqVal: number | null }> = [
          { comp: 'reading', studentVal: lang?.english_reading_score ?? null, reqVal: req.minimum_reading },
          { comp: 'writing', studentVal: lang?.english_writing_score ?? null, reqVal: req.minimum_writing },
          { comp: 'listening', studentVal: lang?.english_listening_score ?? null, reqVal: req.minimum_listening },
          { comp: 'speaking', studentVal: lang?.english_speaking_score ?? null, reqVal: req.minimum_speaking },
        ];
        for (const sc of subChecks) {
          if (sc.reqVal != null && sc.studentVal != null && sc.studentVal < sc.reqVal) {
            languageGaps.push({
              test_type: testType ?? 'unknown',
              student_score: sc.studentVal,
              required_score: sc.reqVal,
              component: sc.comp,
            });
          }
        }
        break;
      }

      case 'subject_minimum': {
        if (req.subject_family) {
          const familyRows = academic.subject_rows.filter(s => s.subject_family === req.subject_family);
          if (familyRows.length === 0) {
            missingSubjects.push(r(`missing_${req.subject_family}`, 'decision.missing.subject',
              req.subject_family));
          } else {
            const bestGrade = Math.max(...familyRows.map(s => s.grade_normalized ?? 0));
            const meets = req.minimum_grade_normalized != null ? bestGrade >= req.minimum_grade_normalized : true;
            matchedSubjects.push({
              family: req.subject_family,
              student_grade_normalized: bestGrade,
              required_grade_normalized: req.minimum_grade_normalized,
              meets_requirement: meets,
            });
            if (!meets) {
              hasBlockingEligibility = true;
              blockers.push({
                blocker_id: `subj_${req.requirement_id}`,
                category: 'academic',
                label_key: 'decision.blockers.subject_grade_below',
                severity: 'warning',
                detail: `${req.subject_family}: ${bestGrade} < ${req.minimum_grade_normalized}`,
              });
            }
          }
        }
        break;
      }

      case 'credential_type_required': {
        if (req.accepted_credential_types?.length) {
          const studentCred = academic.credential_type?.toLowerCase() ?? null;
          if (!studentCred) {
            credentialGaps.push({ student_credential: null, accepted_credentials: req.accepted_credential_types });
          } else if (!req.accepted_credential_types.some(c => c.toLowerCase() === studentCred)) {
            credentialGaps.push({ student_credential: studentCred, accepted_credentials: req.accepted_credential_types });
            hasBlockingEligibility = true;
            blockers.push({
              blocker_id: `cred_${req.requirement_id}`,
              category: 'credential',
              label_key: 'decision.blockers.credential_mismatch',
              severity: 'blocking',
            });
          }
        }
        break;
      }

      case 'portfolio_required': {
        if (req.portfolio_required) {
          missingRequired.push(r('portfolio_needed', 'decision.missing.portfolio'));
        }
        break;
      }
    }
  }

  const eligibilityStatus: EligibilityStatus =
    requirements.length === 0 ? 'unknown' :
    hasBlockingEligibility ? 'not_eligible' :
    missingRequired.length > 0 ? 'conditionally_eligible' :
    'eligible';

  // ════════════════════════════════════════════════════════════
  // C) FIT
  // ════════════════════════════════════════════════════════════

  let fitScore = 0;
  const fitMax = 5;

  // Has academic background
  if (academic.last_education_level || academic.credential_type) { fitScore++; fitReasons.push(r('has_education', 'decision.fit.has_education')); }
  // Has relevant subjects
  if (academic.subject_rows.length > 0) { fitScore++; fitReasons.push(r('has_subjects', 'decision.fit.has_subjects')); }
  // Has targeting preferences
  if (targeting?.preferred_majors?.length) { fitScore++; fitReasons.push(r('has_major_preference', 'decision.fit.has_major')); }
  // Has language readiness
  if (lang?.english_total_score) { fitScore++; fitReasons.push(r('has_language', 'decision.fit.has_language')); }
  // Subject diversity
  if (academic.subject_families_present.length >= 3) { fitScore++; fitReasons.push(r('diverse_subjects', 'decision.fit.diverse_subjects')); }

  const fitStatus: FitStatus =
    fitScore >= 4 ? 'strong_fit' :
    fitScore >= 3 ? 'moderate_fit' :
    fitScore >= 1 ? 'weak_fit' :
    'no_fit';

  // ════════════════════════════════════════════════════════════
  // D) COMPETITIVENESS
  // ════════════════════════════════════════════════════════════

  let compScore = 0;
  const compMax = 5;

  if (studentGpa4 != null) {
    if (studentGpa4 >= 3.5) { compScore += 2; competitiveReasons.push(r('high_gpa', 'decision.comp.high_gpa')); }
    else if (studentGpa4 >= 3.0) { compScore += 1; competitiveReasons.push(r('good_gpa', 'decision.comp.good_gpa')); }
  }

  if (lang?.english_total_score) {
    const testType = lang.english_test_type;
    const score = lang.english_total_score;
    if ((testType === 'ielts' && score >= 7.0) || (testType === 'toefl' && score >= 95)) {
      compScore += 2;
      competitiveReasons.push(r('high_language', 'decision.comp.high_language'));
    } else if ((testType === 'ielts' && score >= 6.0) || (testType === 'toefl' && score >= 80)) {
      compScore += 1;
      competitiveReasons.push(r('adequate_language', 'decision.comp.adequate_language'));
    }
  }

  if (academic.has_science_subjects && academic.has_math) {
    compScore++;
    competitiveReasons.push(r('stem_ready', 'decision.comp.stem_ready'));
  }

  const competitivenessStatus: CompetitivenessStatus =
    compScore >= 4 ? 'strong' :
    compScore >= 2 ? 'moderate' :
    compScore >= 1 ? 'weak' :
    'unknown';

  // ════════════════════════════════════════════════════════════
  // E) DOMAIN DECISIONS
  // ════════════════════════════════════════════════════════════

  const domainResults = evaluateDomains(academic, lang, studentGpa4);

  return {
    completeness_status: completenessStatus,
    completeness_score: completenessScore,
    missing_required_items: missingRequired,

    eligibility_status: eligibilityStatus,
    eligibility_reasons: eligibilityReasons,

    fit_status: fitStatus,
    fit_reasons: fitReasons,

    competitiveness_status: competitivenessStatus,
    competitiveness_reasons: competitiveReasons,

    matched_subjects: matchedSubjects,
    missing_subjects: missingSubjects,

    language_gaps: languageGaps,
    credential_gaps: credentialGaps,
    blockers,

    candidate_domains: domainResults.filter(d => d.status === 'candidate'),
    rejected_domains: domainResults.filter(d => d.status === 'rejected'),
    maybe_domains: domainResults.filter(d => d.status === 'maybe'),

    // Counts: not available without DB query — honestly null
    candidate_country_count: null,
    candidate_university_count: null,
    candidate_program_count: null,

    data_lane_available: false,
    computed_at: now,
  };
}

// ── Helper ───────────────────────────────────────────────────

function r(code: string, labelKey: string, detail?: string): DecisionReason {
  return { code, label_key: labelKey, detail };
}
