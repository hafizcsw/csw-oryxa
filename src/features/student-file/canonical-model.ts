// ═══════════════════════════════════════════════════════════════
// CANONICAL STUDENT FILE — Single Local Truth
// ═══════════════════════════════════════════════════════════════
// This file defines the ONLY accepted shape for a student's file.
// No other file may define student truth fields.
// No localStorage, no Portal-vs-CRM split, no AI-independent truth.
//
// FREEZE RULES (enforced from this commit):
//   1. No localStorage truth in any real lane
//   2. No Portal truth vs CRM truth — one canonical model
//   3. No AI-independent truth writes
//   4. No direct UI write to canonical truth (must go through adapter)
//   5. No premature deletion of existing surfaces before replacement exists
//   6. No CRM sync logic in this file
//   7. No OCR / document parsing / decision engine / report engine
// ═══════════════════════════════════════════════════════════════

// ─── Provenance ───

export type FieldSourceType =
  | 'manual'       // Student typed it in UI
  | 'extracted'    // OCR/AI extracted (future — not wired yet)
  | 'reviewed'     // Staff reviewed & confirmed
  | 'staff'        // Staff entered directly
  | 'migrated'     // Legacy data carried over
  | 'crm_sync';    // Came from CRM edge function

export type FieldState =
  | 'empty'        // No value yet
  | 'proposed'     // Value exists but not confirmed
  | 'accepted'     // Value confirmed
  | 'rejected'     // Value was rejected (needs re-entry)
  | 'conflicting'; // Multiple sources disagree

export interface FieldProvenance {
  source_type: FieldSourceType;
  source_document_id?: string | null;
  verified_status: boolean;
  field_state: FieldState;
  updated_at: string; // ISO 8601
}

// ─── Identity Block ───

export interface CanonicalIdentity {
  full_name: string | null;
  passport_name: string | null;
  passport_number: string | null;
  citizenship: string | null;
  date_of_birth: string | null;        // YYYY-MM-DD
  gender: string | null;
  country_of_residence: string | null;
  passport_issue_date: string | null;   // YYYY-MM-DD
  passport_expiry_date: string | null;  // YYYY-MM-DD
  passport_issuing_country: string | null;
}

// ─── Academic Background Block ───

export interface CanonicalAcademic {
  current_study_level: string | null;
  last_education_level: string | null;
  credential_name: string | null;
  credential_type: string | null;
  awarding_institution: string | null;
  institution_name: string | null;
  graduation_year: number | null;
  degree_conferral_date: string | null; // YYYY-MM-DD
  gpa_raw: string | null;              // As-is from transcript
  gpa_normalized: number | null;        // 0–4.0 scale
  grading_scale: string | null;         // "4.0" | "5.0" | "100" | "percentage"
  country_of_education: string | null;
}

// ─── Language Block ───

export interface CanonicalLanguage {
  english_test_type: string | null;     // ielts | toefl | duolingo | pte | none
  english_total_score: number | null;
  english_reading_score: number | null;
  english_writing_score: number | null;
  english_listening_score: number | null;
  english_speaking_score: number | null;
  english_test_date: string | null;     // YYYY-MM-DD
  english_expiry_date: string | null;   // YYYY-MM-DD
  language_exemption_basis: string | null;
}

// ─── Targeting Block ───

export interface CanonicalTargeting {
  target_degree: string | null;         // bachelor | master | phd | foundation | diploma
  preferred_majors: string[] | null;
  target_countries: string[] | null;
  budget_range: string | null;          // e.g. "5000-10000" or structured
}

// ─── File Status Block ───

export type CompletionStatus =
  | 'incomplete'
  | 'partial'
  | 'complete'
  | 'verified';

export interface CanonicalFileStatus {
  profile_completion_status: CompletionStatus;
  identity_integrity_status: CompletionStatus;
  academic_truth_status: CompletionStatus;
  language_readiness_status: CompletionStatus;
}

// ═══════════════════════════════════════════════════════════════
// THE CANONICAL STUDENT FILE
// ═══════════════════════════════════════════════════════════════

export interface CanonicalStudentFile {
  // Metadata
  student_id: string;                   // auth user id
  customer_id: string | null;           // CRM customer id (may be null if unlinked)
  last_synced_at: string | null;        // ISO 8601

  // Blocks
  identity: CanonicalIdentity;
  academic: CanonicalAcademic;
  language: CanonicalLanguage;
  targeting: CanonicalTargeting;
  file_status: CanonicalFileStatus;

  // Provenance map — keyed by dotted field path e.g. "identity.full_name"
  provenance: Record<string, FieldProvenance>;
}

// ═══════════════════════════════════════════════════════════════
// EMPTY DEFAULTS
// ═══════════════════════════════════════════════════════════════

export const EMPTY_IDENTITY: CanonicalIdentity = {
  full_name: null,
  passport_name: null,
  passport_number: null,
  citizenship: null,
  date_of_birth: null,
  gender: null,
  country_of_residence: null,
  passport_issue_date: null,
  passport_expiry_date: null,
  passport_issuing_country: null,
};

export const EMPTY_ACADEMIC: CanonicalAcademic = {
  current_study_level: null,
  last_education_level: null,
  credential_name: null,
  credential_type: null,
  awarding_institution: null,
  institution_name: null,
  graduation_year: null,
  degree_conferral_date: null,
  gpa_raw: null,
  gpa_normalized: null,
  grading_scale: null,
  country_of_education: null,
};

export const EMPTY_LANGUAGE: CanonicalLanguage = {
  english_test_type: null,
  english_total_score: null,
  english_reading_score: null,
  english_writing_score: null,
  english_listening_score: null,
  english_speaking_score: null,
  english_test_date: null,
  english_expiry_date: null,
  language_exemption_basis: null,
};

export const EMPTY_TARGETING: CanonicalTargeting = {
  target_degree: null,
  preferred_majors: null,
  target_countries: null,
  budget_range: null,
};

export const EMPTY_FILE_STATUS: CanonicalFileStatus = {
  profile_completion_status: 'incomplete',
  identity_integrity_status: 'incomplete',
  academic_truth_status: 'incomplete',
  language_readiness_status: 'incomplete',
};

export function createEmptyStudentFile(studentId: string): CanonicalStudentFile {
  return {
    student_id: studentId,
    customer_id: null,
    last_synced_at: null,
    identity: { ...EMPTY_IDENTITY },
    academic: { ...EMPTY_ACADEMIC },
    language: { ...EMPTY_LANGUAGE },
    targeting: { ...EMPTY_TARGETING },
    file_status: { ...EMPTY_FILE_STATUS },
    provenance: {},
  };
}
