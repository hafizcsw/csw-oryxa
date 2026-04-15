// ═══════════════════════════════════════════════════════════════
// useDecisionEngine — Door 5: Decision engine hook
// ═══════════════════════════════════════════════════════════════
// Runs computeDecision against academic truth + requirements.
// Reactive: recomputes on canonical/academic/requirements change.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import type { CanonicalStudentFile } from '@/features/student-file/canonical-model';
import type { AcademicTruth } from '@/features/academic-truth/types';
import type { ProgramRequirement } from '@/features/program-requirements/types';
import type { DecisionResult } from '@/features/decision-engine/types';
import { computeDecision } from '@/features/decision-engine/engine';

interface UseDecisionEngineOptions {
  canonicalFile: CanonicalStudentFile | null;
  academicTruth: AcademicTruth;
  requirements: ProgramRequirement[];
}

export function useDecisionEngine({
  canonicalFile,
  academicTruth,
  requirements,
}: UseDecisionEngineOptions): DecisionResult {
  return useMemo(
    () => computeDecision(canonicalFile, academicTruth, requirements),
    [canonicalFile, academicTruth, requirements],
  );
}
