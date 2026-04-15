import { getPathModuleSlugs, normalizeRussianPathInput, resolveRussianPath, type OnboardingState, type ResolvedPath } from "@/lib/learningPathResolver";
import { getModulesForPath, type Module } from "@/lib/russianCourse";

const STORAGE_KEY = "languages_russian_onboarding";

interface EnrollmentPathSource {
  goal?: string | null;
  timeline?: string | null;
  level_mode?: string | null;
  daily_minutes?: string | number | null;
  academic_track?: string | null;
  placement_result?: string | null;
  placement_score?: number | null;
}

export interface RussianPathContext {
  onboardingState: OnboardingState | null;
  resolvedPath: ResolvedPath | null;
  pathModules: Module[];
}

export function getStoredRussianOnboarding(): Record<string, unknown> | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function resolveRussianPathContext(enrollment?: EnrollmentPathSource | null): RussianPathContext {
  const normalized = normalizeRussianPathInput({
    goal: enrollment?.goal,
    timeline: enrollment?.timeline,
    level: enrollment?.level_mode,
    dailyMinutes: enrollment?.daily_minutes,
    academicTrack: enrollment?.academic_track,
    placementResult: enrollment?.placement_result,
    placementScore: enrollment?.placement_score,
  }) ?? normalizeRussianPathInput(getStoredRussianOnboarding() || {});

  const resolvedPath = normalized ? resolveRussianPath(normalized) : null;
  const pathModules = resolvedPath ? getModulesForPath(getPathModuleSlugs(resolvedPath)) : [];

  return {
    onboardingState: normalized,
    resolvedPath,
    pathModules,
  };
}
