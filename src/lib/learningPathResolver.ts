/**
 * Learning Path Resolver
 * 
 * Resolves (language + goal + academicTrack + level + placementResult + timeline) → path_key
 * 
 * The resolved path determines which modules/lessons are visible in the dashboard.
 */

export interface OnboardingState {
  goal: string;
  timeline: string;
  level: string;
  dailyMinutes: string;
  academicTrack?: string;       // medicine | engineering | general_academic | not_sure
  placementResult?: string;     // legacy or placement v2 band
  placementScore?: number;
}

export interface ResolvedPath {
  pathKey: string;               // e.g. russian_prep_medicine
  language: string;
  coreModules: string[];         // module slugs from common core
  branchModules: string[];       // module slugs specific to this path
  startModule?: string;          // override start if placement says so
  nameKey: string;               // i18n key for path display name
  descKey: string;               // i18n key for path description
}

const COMMON_CORE = ["script-sounds", "core-interaction", "survival-navigation"]; // A0-A1 foundation modules

export interface RussianPathInput {
  goal?: string | null;
  timeline?: string | null;
  level?: string | null;
  dailyMinutes?: string | number | null;
  academicTrack?: string | null;
  placementResult?: string | null;
  placementScore?: number | null;
}

export function normalizeRussianPathInput(input: RussianPathInput): OnboardingState | null {
  const goal = input.goal ?? "";
  const timeline = input.timeline ?? "";
  const level = input.level ?? "";
  const dailyMinutesValue = input.dailyMinutes;
  const dailyMinutes =
    typeof dailyMinutesValue === "number"
      ? String(dailyMinutesValue)
      : (dailyMinutesValue ?? "");

  if (!goal || !timeline || !level || !dailyMinutes) return null;

  return {
    goal,
    timeline,
    level,
    dailyMinutes,
    academicTrack: input.academicTrack ?? undefined,
    placementResult: input.placementResult ?? undefined,
    placementScore: input.placementScore ?? undefined,
  };
}

/**
 * Resolve the learning path for Russian based on onboarding choices.
 */
export function resolveRussianPath(state: OnboardingState): ResolvedPath {
  const { goal, academicTrack, placementResult } = state;
  const base = { language: "russian", coreModules: [...COMMON_CORE] };

  // Determine start module from placement
  let startModule: string | undefined;
  if (placementResult === "basics_refresh" || placementResult === "PB1_GENERAL_FOUNDATION") startModule = "core-interaction";
  if (placementResult === "PB2_GENERAL_CORE") startModule = "survival-navigation";
  if (placementResult === "early_academic" || placementResult === "PB3_ACADEMIC_ENTRY") startModule = "classroom-basics";
  if (placementResult === "PB4_ACADEMIC_READY_EARLY_TRACK_SIGNAL") startModule = "reading-patterns";
  if (placementResult === "PB5_PREP_ACCELERATED_ENTRY") startModule = "note-taking-response";

  // ── Prep exam paths ──
  if (goal === "prep_exam") {
    const academicModules = ["classroom-basics", "reading-patterns", "checkpoint-foundation", "note-taking-response", "case-awareness", "verbs-motion-time", "checkpoint-academic-entry"];
    if (academicTrack === "medicine") {
      return {
        ...base,
        pathKey: "russian_prep_medicine",
        branchModules: academicModules,
        startModule,
        nameKey: "languages.dashboard.paths.prepMedicine.name",
        descKey: "languages.dashboard.paths.prepMedicine.desc",
      };
    }
    if (academicTrack === "engineering") {
      return {
        ...base,
        pathKey: "russian_prep_engineering",
        branchModules: academicModules,
        startModule,
        nameKey: "languages.dashboard.paths.prepEngineering.name",
        descKey: "languages.dashboard.paths.prepEngineering.desc",
      };
    }
    return {
      ...base,
      pathKey: "russian_prep_general",
      branchModules: academicModules,
      startModule,
      nameKey: "languages.dashboard.paths.prepGeneral.name",
      descKey: "languages.dashboard.paths.prepGeneral.desc",
    };
  }

  // ── University study paths ──
  if (goal === "university_study") {
    const academicModules = ["classroom-basics", "reading-patterns", "checkpoint-foundation", "note-taking-response", "case-awareness", "verbs-motion-time", "checkpoint-academic-entry"];
    if (academicTrack === "medicine") {
      return {
        ...base,
        pathKey: "russian_academic_medicine",
        branchModules: academicModules,
        startModule,
        nameKey: "languages.dashboard.paths.academicMedicine.name",
        descKey: "languages.dashboard.paths.academicMedicine.desc",
      };
    }
    if (academicTrack === "engineering") {
      return {
        ...base,
        pathKey: "russian_academic_engineering",
        branchModules: academicModules,
        startModule,
        nameKey: "languages.dashboard.paths.academicEngineering.name",
        descKey: "languages.dashboard.paths.academicEngineering.desc",
      };
    }
    return {
      ...base,
      pathKey: "russian_academic_general",
      branchModules: academicModules,
      startModule,
      nameKey: "languages.dashboard.paths.academicGeneral.name",
      descKey: "languages.dashboard.paths.academicGeneral.desc",
    };
  }

  // ── Daily life / speaking / other → general conversational (skip advanced academic) ──
  return {
    ...base,
    pathKey: "russian_general",
    branchModules: ["classroom-basics", "reading-patterns", "checkpoint-foundation", "case-awareness", "verbs-motion-time"],
    startModule,
    nameKey: "languages.dashboard.paths.general.name",
    descKey: "languages.dashboard.paths.general.desc",
  };
}

/**
 * Get the full ordered list of module slugs for a resolved path.
 */
export function getPathModuleSlugs(resolved: ResolvedPath): string[] {
  return [...resolved.coreModules, ...resolved.branchModules];
}

/**
 * Check if the onboarding goal needs the academic track step.
 */
export function needsAcademicTrack(goal: string): boolean {
  return goal === "prep_exam" || goal === "university_study";
}
