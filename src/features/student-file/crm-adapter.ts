// ═══════════════════════════════════════════════════════════════
// CRM → Canonical Adapter (Temporary Compatibility)
// ═══════════════════════════════════════════════════════════════
// Maps existing StudentPortalProfile (CRM edge function response)
// into the CanonicalStudentFile shape.
//
// This adapter exists ONLY to prevent surface breakage.
// It does NOT sync back to CRM — that is a future door.
//
// CANONICAL OWNER: CanonicalStudentFile (canonical-model.ts)
// TEMPORARY COMPAT: StudentPortalProfile → CanonicalStudentFile
// PLANNED DEPRECATION: When CRM returns canonical shape directly
// ═══════════════════════════════════════════════════════════════

import type { StudentPortalProfile } from '@/hooks/useStudentProfile';
import type { StudentDocument } from '@/hooks/useStudentDocuments';
import type {
  CanonicalStudentFile,
  FieldProvenance,
  CanonicalFileStatus,
  CompletionStatus,
} from './canonical-model';
import {
  EMPTY_IDENTITY,
  EMPTY_ACADEMIC,
  EMPTY_LANGUAGE,
  EMPTY_TARGETING,
  EMPTY_FILE_STATUS,
} from './canonical-model';

// ─── Provenance helper ───

function crmProv(updated_at?: string | null): FieldProvenance {
  return {
    source_type: 'crm_sync',
    source_document_id: null,
    verified_status: false,
    field_state: 'proposed',
    updated_at: updated_at || new Date().toISOString(),
  };
}

function filledProv(
  value: unknown,
  updated_at?: string | null,
): FieldProvenance {
  const prov = crmProv(updated_at);
  prov.field_state = value != null && value !== '' ? 'proposed' : 'empty';
  return prov;
}

// ─── Status calculators ───

function calcProfileStatus(crm: StudentPortalProfile | null): CompletionStatus {
  if (!crm) return 'incomplete';
  const filled = [crm.full_name, crm.gender, crm.phone, crm.email, crm.country].filter(Boolean).length;
  if (filled >= 5) return 'complete';
  if (filled >= 2) return 'partial';
  return 'incomplete';
}

function calcIdentityStatus(crm: StudentPortalProfile | null): CompletionStatus {
  if (!crm) return 'incomplete';
  const filled = [crm.passport_name, crm.passport_number, crm.passport_expiry].filter(Boolean).length;
  if (filled >= 3) return 'complete';
  if (filled >= 1) return 'partial';
  return 'incomplete';
}

function calcAcademicStatus(crm: StudentPortalProfile | null): CompletionStatus {
  if (!crm) return 'incomplete';
  const filled = [crm.last_education_level, crm.gpa].filter(Boolean).length;
  if (filled >= 2) return 'complete';
  if (filled >= 1) return 'partial';
  return 'incomplete';
}

function calcLanguageStatus(_crm: StudentPortalProfile | null): CompletionStatus {
  // Currently no english score fields in CRM profile — always incomplete
  return 'incomplete';
}

// ─── Main adapter ───

export function mapCrmToCanonical(
  crm: StudentPortalProfile | null,
  _docs: StudentDocument[],
  userId: string,
): CanonicalStudentFile {
  if (!crm) {
    return {
      student_id: userId,
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

  const now = new Date().toISOString();

  const identity = {
    full_name: crm.full_name ?? null,
    passport_name: crm.passport_name ?? null,
    passport_number: crm.passport_number ?? null,
    citizenship: crm.citizenship ?? null,
    date_of_birth: crm.dob ?? null,
    gender: crm.gender ?? null,
    country_of_residence: crm.country ?? null,
    passport_issue_date: null,           // Not in CRM yet
    passport_expiry_date: crm.passport_expiry ?? null,
    passport_issuing_country: null,      // Not in CRM yet
  };

  const academic = {
    current_study_level: null,           // Not in CRM yet
    last_education_level: crm.last_education_level ?? null,
    credential_name: null,
    credential_type: null,
    awarding_institution: null,
    institution_name: null,
    graduation_year: null,
    degree_conferral_date: null,
    gpa_raw: crm.gpa ?? null,
    gpa_normalized: null,                // Needs normalization engine (future)
    grading_scale: null,
    country_of_education: null,
  };

  const language = {
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

  const targeting = {
    target_degree: crm.preferred_degree_level ?? null,
    preferred_majors: crm.preferred_major ? [crm.preferred_major] : null,
    target_countries: null,              // Not structured in CRM yet
    budget_range: crm.budget_usd != null ? String(crm.budget_usd) : null,
  };

  const file_status: CanonicalFileStatus = {
    profile_completion_status: calcProfileStatus(crm),
    identity_integrity_status: calcIdentityStatus(crm),
    academic_truth_status: calcAcademicStatus(crm),
    language_readiness_status: calcLanguageStatus(crm),
  };

  // Build provenance for all non-null fields
  const provenance: Record<string, FieldProvenance> = {};
  for (const [block, fields] of Object.entries({ identity, academic, language, targeting })) {
    for (const [key, value] of Object.entries(fields)) {
      provenance[`${block}.${key}`] = filledProv(value, now);
    }
  }

  return {
    student_id: userId,
    customer_id: crm.customer_id ?? null,
    last_synced_at: now,
    identity,
    academic,
    language,
    targeting,
    file_status,
    provenance,
  };
}

// ═══════════════════════════════════════════════════════════════
// FIELD MAPPING REGISTRY
// Documents which fields come from CRM vs are new/empty
// ═══════════════════════════════════════════════════════════════

export const FIELD_ORIGIN_MAP: Record<string, {
  canonical_owner: string;
  crm_source_field: string | null;
  temporary_compat: string | null;
  deprecation: string;
}> = {
  'identity.full_name':           { canonical_owner: 'CanonicalStudentFile', crm_source_field: 'full_name',              temporary_compat: 'StudentPortalProfile.full_name',            deprecation: 'When CRM returns canonical shape' },
  'identity.passport_name':       { canonical_owner: 'CanonicalStudentFile', crm_source_field: 'passport_name',          temporary_compat: 'StudentPortalProfile.passport_name',        deprecation: 'When CRM returns canonical shape' },
  'identity.passport_number':     { canonical_owner: 'CanonicalStudentFile', crm_source_field: 'passport_number',        temporary_compat: 'StudentPortalProfile.passport_number',      deprecation: 'When CRM returns canonical shape' },
  'identity.citizenship':         { canonical_owner: 'CanonicalStudentFile', crm_source_field: 'citizenship',            temporary_compat: 'StudentPortalProfile.citizenship',          deprecation: 'When CRM returns canonical shape' },
  'identity.date_of_birth':       { canonical_owner: 'CanonicalStudentFile', crm_source_field: 'dob',                    temporary_compat: 'StudentPortalProfile.dob + birth_year',     deprecation: 'When CRM returns canonical shape' },
  'identity.gender':              { canonical_owner: 'CanonicalStudentFile', crm_source_field: 'gender',                 temporary_compat: 'StudentPortalProfile.gender',               deprecation: 'When CRM returns canonical shape' },
  'identity.country_of_residence':{ canonical_owner: 'CanonicalStudentFile', crm_source_field: 'country',                temporary_compat: 'StudentPortalProfile.country',              deprecation: 'When CRM returns canonical shape' },
  'identity.passport_issue_date': { canonical_owner: 'CanonicalStudentFile', crm_source_field: null,                     temporary_compat: null,                                        deprecation: 'New field — no legacy path' },
  'identity.passport_expiry_date':{ canonical_owner: 'CanonicalStudentFile', crm_source_field: 'passport_expiry',        temporary_compat: 'StudentPortalProfile.passport_expiry',      deprecation: 'When CRM returns canonical shape' },
  'identity.passport_issuing_country': { canonical_owner: 'CanonicalStudentFile', crm_source_field: null,                temporary_compat: null,                                        deprecation: 'New field — no legacy path' },
  'academic.last_education_level':{ canonical_owner: 'CanonicalStudentFile', crm_source_field: 'last_education_level',   temporary_compat: 'StudentPortalProfile.last_education_level', deprecation: 'When CRM returns canonical shape' },
  'academic.gpa_raw':             { canonical_owner: 'CanonicalStudentFile', crm_source_field: 'gpa',                    temporary_compat: 'StudentPortalProfile.gpa',                  deprecation: 'When CRM returns canonical shape' },
  'targeting.target_degree':      { canonical_owner: 'CanonicalStudentFile', crm_source_field: 'preferred_degree_level', temporary_compat: 'StudentPortalProfile.preferred_degree_level',deprecation: 'When CRM returns canonical shape' },
  'targeting.preferred_majors':   { canonical_owner: 'CanonicalStudentFile', crm_source_field: 'preferred_major',        temporary_compat: 'StudentPortalProfile.preferred_major (string→array)', deprecation: 'When CRM returns canonical shape' },
  'targeting.budget_range':       { canonical_owner: 'CanonicalStudentFile', crm_source_field: 'budget_usd',             temporary_compat: 'StudentPortalProfile.budget_usd (number→string)', deprecation: 'When CRM returns canonical shape' },
};
