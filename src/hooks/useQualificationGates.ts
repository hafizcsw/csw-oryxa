import { useMemo } from 'react';
import { useFileQuality } from '@/hooks/useFileQuality';
import type { StudentPortalProfile } from '@/hooks/useStudentProfile';
import type { StudentDocument } from '@/hooks/useStudentDocuments';

export type GateName = 'apply' | 'message_university';

export interface GateCheckResult {
  allowed: boolean;
  reasons: string[]; // i18n keys
}

export interface QualificationGates {
  canApply: GateCheckResult;
  canMessage: GateCheckResult;
  overallScore: number;
  verdict: string;
  checkGate: (gate: GateName) => GateCheckResult;
}

export function useQualificationGates(
  profile: StudentPortalProfile | null,
  documents: StudentDocument[],
): QualificationGates {
  const fq = useFileQuality(profile, documents);

  return useMemo(() => {
    const canApply: GateCheckResult = {
      allowed: fq.gates.can_apply,
      reasons: fq.gates.apply_blocked_reasons,
    };

    const canMessage: GateCheckResult = {
      allowed: fq.gates.can_message_university,
      reasons: fq.gates.can_message_university
        ? []
        : ['file_quality.gate_reasons.profile_incomplete'],
    };

    const checkGate = (gate: GateName): GateCheckResult =>
      gate === 'apply' ? canApply : canMessage;

    return {
      canApply,
      canMessage,
      overallScore: fq.overall_score,
      verdict: fq.verdict,
      checkGate,
    };
  }, [fq]);
}
