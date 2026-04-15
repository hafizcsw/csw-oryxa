import { russianIntensive750StageMap } from '@/lib/russianIntensive750Plan';
import type { RussianIntensiveStageKey } from '@/types/russianIntensive750';

const STORAGE_KEY = 'russian_intensive_750_proof_override';

export interface RussianIntensive750ProofOverride {
  currentLessonNumber?: number | null;
  currentWeek?: number | null;
  stageKey?: RussianIntensiveStageKey | null;
  enabled?: boolean;
  createdAt?: string | null;
}

export function getRussianIntensive750ProofOverride(): RussianIntensive750ProofOverride | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RussianIntensive750ProofOverride;
    return parsed?.enabled === false ? null : parsed;
  } catch {
    return null;
  }
}

export function resolveRussianIntensiveProofLessonNumber(override: RussianIntensive750ProofOverride | null, fallbackLessonNumber: number) {
  if (!override) return fallbackLessonNumber;
  if (typeof override.currentLessonNumber === 'number' && override.currentLessonNumber > 0) {
    return override.currentLessonNumber;
  }
  if (typeof override.currentWeek === 'number' && override.currentWeek > 0) {
    return ((override.currentWeek - 1) * 6) + 1;
  }
  if (override.stageKey) {
    const stage = russianIntensive750StageMap.find((candidate) => candidate.stageKey === override.stageKey);
    if (stage) return stage.lessonRange.start;
  }
  return fallbackLessonNumber;
}

export function getRussianIntensive750ProofStorageKey() {
  return STORAGE_KEY;
}
