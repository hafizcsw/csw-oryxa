/**
 * useStudentReadiness — Canonical composed hook
 * 
 * Three distinct signals:
 *   completeness  → FileQualityResult (is the file complete?)
 *   eligibility   → ReadinessResult   (is the student eligible for target X?)
 *   fit/gates     → QualificationGates (can the student act: apply, message?)
 *
 * All sourced from CRM-backed StudentPortalProfile + StudentDocuments.
 * No localStorage. No duplicate scoring.
 */
import { useMemo } from 'react';
import { useFileQuality } from '@/hooks/useFileQuality';
import { useQualificationGates } from '@/hooks/useQualificationGates';
import { adaptCrmToReadinessProfile } from '@/features/readiness/profileAdapter';
import { calculateReadiness } from '@/features/readiness/engine';
import type { StudentPortalProfile } from '@/hooks/useStudentProfile';
import type { StudentDocument } from '@/hooks/useStudentDocuments';
import type { RequirementTruthContext, ReadinessResult } from '@/features/readiness/types';
import type { FileQualityResult } from '@/features/file-quality/types';
import type { QualificationGates } from '@/hooks/useQualificationGates';

export interface StudentReadiness {
  /** File completeness assessment (profile + docs quality) */
  completeness: FileQualityResult;
  /** Target-aware eligibility (against a specific program/university's requirements) */
  eligibility: ReadinessResult;
  /** Action gates: can apply, can message */
  gates: QualificationGates;
  /** Whether CRM data is loaded */
  hasProfile: boolean;
}

export function useStudentReadiness(
  profile: StudentPortalProfile | null,
  documents: StudentDocument[],
  targetRequirements?: RequirementTruthContext,
): StudentReadiness {
  // 1. Completeness — existing file-quality engine, CRM-backed
  const completeness = useFileQuality(profile, documents);

  // 2. Gates — existing qualification gates, CRM-backed
  const gates = useQualificationGates(profile, documents);

  // 3. Eligibility — readiness engine fed by CRM adapter
  const eligibility = useMemo(() => {
    const readinessProfile = adaptCrmToReadinessProfile(profile, documents);
    return calculateReadiness(readinessProfile, targetRequirements);
  }, [profile, documents, targetRequirements]);

  return {
    completeness,
    eligibility,
    gates,
    hasProfile: profile !== null,
  };
}
