// ═══════════════════════════════════════════════════════════════
// useCanonicalStudentFile — Read-only canonical truth at runtime
// ═══════════════════════════════════════════════════════════════
// Adapts the existing CRM profile + documents into the canonical
// student file shape. Read-only — no writeback through this hook.
//
// This is the FIRST runtime consumer of CanonicalStudentFile.
// Door 1 scope: read-only adoption only.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import type { StudentPortalProfile } from '@/hooks/useStudentProfile';
import type { StudentDocument } from '@/hooks/useStudentDocuments';
import type { CanonicalStudentFile } from '@/features/student-file/canonical-model';
import { mapCrmToCanonical } from '@/features/student-file/crm-adapter';

interface UseCanonicalStudentFileOptions {
  crmProfile: StudentPortalProfile | null;
  documents: StudentDocument[];
  userId: string | null;
}

interface UseCanonicalStudentFileResult {
  /** The canonical student file — null only when userId is missing */
  canonicalFile: CanonicalStudentFile | null;
  /** True when canonical file has any identity fields filled */
  hasIdentity: boolean;
  /** True when canonical file has any academic fields filled */
  hasAcademic: boolean;
  /** True when canonical file has any language fields filled */
  hasLanguage: boolean;
  /** True when canonical file has any targeting fields filled */
  hasTargeting: boolean;
}

export function useCanonicalStudentFile({
  crmProfile,
  documents,
  userId,
}: UseCanonicalStudentFileOptions): UseCanonicalStudentFileResult {
  const canonicalFile = useMemo(() => {
    if (!userId) return null;
    const file = mapCrmToCanonical(crmProfile, documents, userId);
    // Runtime proof: log once when canonical truth is constructed
    if (import.meta.env.DEV) {
      console.log('[CanonicalStudentFile] Runtime truth constructed', {
        student_id: file.student_id,
        customer_id: file.customer_id,
        file_status: file.file_status,
        provenance_keys: Object.keys(file.provenance).length,
      });
    }
    return file;
  }, [crmProfile, documents, userId]);

  const hasIdentity = useMemo(() => {
    if (!canonicalFile) return false;
    const { identity } = canonicalFile;
    return !!(identity.full_name || identity.passport_name || identity.passport_number || identity.citizenship || identity.date_of_birth);
  }, [canonicalFile]);

  const hasAcademic = useMemo(() => {
    if (!canonicalFile) return false;
    const { academic } = canonicalFile;
    return !!(academic.last_education_level || academic.gpa_raw || academic.institution_name);
  }, [canonicalFile]);

  const hasLanguage = useMemo(() => {
    if (!canonicalFile) return false;
    const { language } = canonicalFile;
    return !!(language.english_test_type || language.english_total_score);
  }, [canonicalFile]);

  const hasTargeting = useMemo(() => {
    if (!canonicalFile) return false;
    const { targeting } = canonicalFile;
    return !!(targeting.target_degree || targeting.preferred_majors?.length || targeting.target_countries?.length);
  }, [canonicalFile]);

  return { canonicalFile, hasIdentity, hasAcademic, hasLanguage, hasTargeting };
}
