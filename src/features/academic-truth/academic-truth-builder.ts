// ═══════════════════════════════════════════════════════════════
// Academic Truth Builder — Door 4
// ═══════════════════════════════════════════════════════════════
// Builds AcademicTruth from CanonicalStudentFile + SubjectRow[].
// Pure function. No side effects.
// ═══════════════════════════════════════════════════════════════

import type { CanonicalStudentFile } from '../student-file/canonical-model';
import type { AcademicTruth, SubjectRow, StudyStatus, SubjectFamily } from './types';

export function buildAcademicTruth(
  canonical: CanonicalStudentFile | null,
  subjectRows: SubjectRow[],
): AcademicTruth {
  const acad = canonical?.academic;

  const familiesPresent = new Set<SubjectFamily>();
  for (const row of subjectRows) {
    familiesPresent.add(row.subject_family);
  }

  const totalCredits = subjectRows.reduce((sum, r) => sum + (r.credits ?? 0), 0) || null;

  return {
    current_education_level: acad?.current_study_level ?? null,
    last_education_level: acad?.last_education_level ?? null,
    credential_name: acad?.credential_name ?? null,
    credential_type: acad?.credential_type ?? null,
    awarding_institution: acad?.awarding_institution ?? null,
    institution_name: acad?.institution_name ?? null,
    graduation_year: acad?.graduation_year ?? null,
    degree_conferral_date: acad?.degree_conferral_date ?? null,
    gpa_raw: acad?.gpa_raw ?? null,
    gpa_normalized: acad?.gpa_normalized ?? null,
    grading_scale: acad?.grading_scale ?? null,
    country_of_education: acad?.country_of_education ?? null,
    study_status: inferStudyStatus(acad?.credential_type),
    transcript_language: null, // V1: not extracted

    subject_rows: subjectRows,
    has_science_subjects: familiesPresent.has('biology') || familiesPresent.has('chemistry') || familiesPresent.has('physics'),
    has_math: familiesPresent.has('mathematics'),
    has_english: familiesPresent.has('english'),
    subject_families_present: Array.from(familiesPresent),
    total_credits: totalCredits,
  };
}

function inferStudyStatus(credentialType: string | null | undefined): StudyStatus {
  if (!credentialType) return 'unknown';
  const lower = credentialType.toLowerCase();
  if (['graduated', 'completed'].includes(lower)) return 'graduated';
  if (lower === 'enrolled') return 'enrolled';
  if (lower === 'withdrawn') return 'withdrawn';
  if (lower === 'dismissed') return 'dismissed';
  return 'unknown';
}
