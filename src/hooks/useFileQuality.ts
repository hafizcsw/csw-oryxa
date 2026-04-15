import { useMemo } from 'react';
import { assessFileQuality } from '@/features/file-quality/engine';
import type { FileQualityResult } from '@/features/file-quality/types';
import type { StudentPortalProfile } from '@/hooks/useStudentProfile';
import type { StudentDocument } from '@/hooks/useStudentDocuments';

/**
 * Computes canonical file quality from profile + documents.
 * Consumer passes the data; this hook is a pure memo wrapper.
 */
export function useFileQuality(
  profile: StudentPortalProfile | null,
  documents: StudentDocument[],
): FileQualityResult {
  return useMemo(
    () => assessFileQuality(profile, documents),
    [profile, documents],
  );
}
