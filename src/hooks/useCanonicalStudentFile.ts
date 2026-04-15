// ═══════════════════════════════════════════════════════════════
// useCanonicalStudentFile — Canonical truth at runtime
// ═══════════════════════════════════════════════════════════════
// Adapts CRM profile + documents into canonical shape,
// then merges promoted fields from Door 3 analysis.
//
// Door 1 scope: read-only CRM adoption + Door 3 overlay.
// No CRM writeback.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import type { StudentPortalProfile } from '@/hooks/useStudentProfile';
import type { StudentDocument } from '@/hooks/useStudentDocuments';
import type { CanonicalStudentFile, FieldProvenance } from '@/features/student-file/canonical-model';
import { mapCrmToCanonical } from '@/features/student-file/crm-adapter';
import type { PromotedField } from '@/hooks/useDocumentAnalysis';

interface UseCanonicalStudentFileOptions {
  crmProfile: StudentPortalProfile | null;
  documents: StudentDocument[];
  userId: string | null;
  /** Promoted fields from Door 3 analysis — merged into canonical truth */
  promotedFields?: PromotedField[];
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

/**
 * Apply promoted fields from Door 3 onto a canonical file.
 * Each promoted field writes to the matching block.field path
 * and updates provenance to reflect extraction source.
 */
function mergePromotedFields(
  base: CanonicalStudentFile,
  promoted: PromotedField[],
): CanonicalStudentFile {
  if (promoted.length === 0) return base;

  // Deep clone blocks to avoid mutating base
  const merged: CanonicalStudentFile = {
    ...base,
    identity: { ...base.identity },
    academic: { ...base.academic },
    language: { ...base.language },
    targeting: { ...base.targeting },
    provenance: { ...base.provenance },
  };

  for (const pf of promoted) {
    const [block, key] = pf.fieldKey.split('.');
    if (!block || !key) continue;

    const blockObj = (merged as any)[block];
    if (!blockObj || typeof blockObj !== 'object') continue;

    // Only write if the key exists in the canonical model
    if (!(key in blockObj)) continue;

    // Write the promoted value
    // Handle numeric fields
    const numericFields = [
      'graduation_year', 'gpa_normalized',
      'english_total_score', 'english_reading_score', 'english_writing_score',
      'english_listening_score', 'english_speaking_score',
    ];
    if (numericFields.includes(key)) {
      const num = Number(pf.value);
      blockObj[key] = isNaN(num) ? pf.value : num;
    } else {
      blockObj[key] = pf.value;
    }

    // Update provenance
    const provKey = `${block}.${key}`;
    const prov: FieldProvenance = {
      source_type: 'extracted',
      source_document_id: pf.proposalId,
      verified_status: pf.source === 'manual_accepted',
      field_state: 'accepted',
      updated_at: new Date().toISOString(),
    };
    merged.provenance[provKey] = prov;
  }

  if (import.meta.env.DEV) {
    console.log('[CanonicalStudentFile] Merged promoted fields', {
      count: promoted.length,
      fields: promoted.map(p => p.fieldKey),
    });
  }

  return merged;
}

export function useCanonicalStudentFile({
  crmProfile,
  documents,
  userId,
  promotedFields = [],
}: UseCanonicalStudentFileOptions): UseCanonicalStudentFileResult {
  const baseFile = useMemo(() => {
    if (!userId) return null;
    const file = mapCrmToCanonical(crmProfile, documents, userId);
    if (import.meta.env.DEV) {
      console.log('[CanonicalStudentFile] Base truth constructed', {
        student_id: file.student_id,
        customer_id: file.customer_id,
        file_status: file.file_status,
        provenance_keys: Object.keys(file.provenance).length,
      });
    }
    return file;
  }, [crmProfile, documents, userId]);

  // Merge promoted fields from Door 3 into canonical truth
  const canonicalFile = useMemo(() => {
    if (!baseFile) return null;
    return mergePromotedFields(baseFile, promotedFields);
  }, [baseFile, promotedFields]);

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
