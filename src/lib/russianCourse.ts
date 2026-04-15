// Shared course structure and progress tracking for Russian Prep

import { russianRuntimeLessons, russianRuntimeModules } from '@/lib/russianExecutionPackSeed';
import { getRussianRuntimeLesson, type RussianLessonRuntime } from '@/lib/russianLessonRuntime';

export interface Lesson {
  slug: string;
  titleKey: string;
  objectiveKey: string;
  contentKey: string;
  vocabularyKeys: string[];
  lessonKey?: string;
  runtimeLesson?: RussianLessonRuntime | null;
}

export interface Module {
  slug: string;
  num: number;
  titleKey: string;
  descKey: string;
  cefrLevel: string;
  moduleKey?: string;
  lessons: Lesson[];
}

export interface LearningProgress {
  completedLessons: string[];
  currentLesson: string | null;
  currentModule: string | null;
  lastVisitedAt: string | null;
  learningStartedAt: string | null;
}

const PROGRESS_KEY = 'languages_russian_progress';
const BLOCK_PROGRESS_KEY = 'languages_russian_block_progress';
const CHECKPOINT_KEY = 'languages_russian_checkpoints';

/** Checkpoint quiz gate — stored as a set of passed checkpoint IDs */
export function getPassedCheckpoints(): Set<string> {
  try {
    const saved = localStorage.getItem(CHECKPOINT_KEY);
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  return new Set();
}

export function markCheckpointPassed(checkpointId: string) {
  const passed = getPassedCheckpoints();
  passed.add(checkpointId);
  localStorage.setItem(CHECKPOINT_KEY, JSON.stringify([...passed]));
}

/** Generate checkpoint ID for a module at a given position (every 3 lessons) */
export function getModuleCheckpointId(moduleSlug: string, groupIndex: number): string {
  return `cp_${moduleSlug}_g${groupIndex}`;
}

/** Check if a lesson is blocked by an unfinished checkpoint gate */
export function isLessonBlockedByCheckpoint(
  lessonSlug: string,
  modules: Module[],
  completedLessons: string[],
): boolean {
  for (const mod of modules) {
    const lessonIdx = mod.lessons.findIndex(l => l.slug === lessonSlug);
    if (lessonIdx < 0) continue;
    // Lesson is in this module. Check if any prior checkpoint group is incomplete
    const groupIndex = Math.floor(lessonIdx / 3);
    // For each prior group (0..groupIndex-1), all 3 lessons must be completed AND checkpoint passed
    const passedCheckpoints = getPassedCheckpoints();
    for (let g = 0; g < groupIndex; g++) {
      const cpId = getModuleCheckpointId(mod.slug, g);
      const groupLessons = mod.lessons.slice(g * 3, g * 3 + 3);
      const allCompleted = groupLessons.every(l => completedLessons.includes(l.slug));
      if (!allCompleted || !passedCheckpoints.has(cpId)) return true;
    }
    return false;
  }
  return false;
}



export function getLessonBlockProgress() {
  try {
    const saved = localStorage.getItem(BLOCK_PROGRESS_KEY);
    if (saved) return JSON.parse(saved) as Record<string, Record<string, boolean>>;
  } catch {}
  return {} as Record<string, Record<string, boolean>>;
}

export function markLessonBlockComplete(lessonSlug: string, blockId: string, completed = true) {
  const progress = getLessonBlockProgress();
  if (!progress[lessonSlug]) progress[lessonSlug] = {};
  progress[lessonSlug][blockId] = completed;
  localStorage.setItem(BLOCK_PROGRESS_KEY, JSON.stringify(progress));
  return progress[lessonSlug];
}

export function getLessonBlockMasteryStatus(lessonSlug: string) {
  const runtimeLesson = getRussianRuntimeLesson(lessonSlug);
  if (!runtimeLesson) {
    return {
      blockMastered: false,
      requiredCompleted: 0,
      requiredTotal: 0,
      percent: 0,
      minimumQuizScore: null,
      quizScoreEvaluated: false,
    };
  }

  const blockProgress = getLessonBlockProgress()[lessonSlug] ?? {};
  const requiredBlocks = runtimeLesson.orderedBlocks.filter((block) => block.required);
  const requiredCompleted = requiredBlocks.filter((block) => blockProgress[block.id]).length;
  const percent = requiredBlocks.length ? Math.round((requiredCompleted / requiredBlocks.length) * 100) : 0;

  const mustCompleteTypes = new Set(runtimeLesson.masteryRules.mustCompleteBlockTypes);
  const mustTypesMet = [...mustCompleteTypes].every((blockType) =>
    runtimeLesson.orderedBlocks.some((block) => block.type === blockType && blockProgress[block.id])
  );

  const blockMastered = requiredCompleted >= runtimeLesson.masteryRules.minimumRequiredBlocks && mustTypesMet;

  return {
    blockMastered,
    requiredCompleted,
    requiredTotal: requiredBlocks.length,
    percent,
    minimumQuizScore: runtimeLesson.masteryRules.minimumQuizScore,
    quizScoreEvaluated: false,
  };
}
export function getProgress(): LearningProgress {
  try {
    const saved = localStorage.getItem(PROGRESS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { completedLessons: [], currentLesson: null, currentModule: null, lastVisitedAt: null, learningStartedAt: null };
}

export function saveProgress(progress: LearningProgress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({
    ...progress,
    lastVisitedAt: new Date().toISOString(),
  }));
}

export function markLessonComplete(lessonSlug: string) {
  const p = getProgress();
  if (!p.completedLessons.includes(lessonSlug)) {
    p.completedLessons.push(lessonSlug);
  }
  saveProgress(p);
  return p;
}

export function setCurrentPosition(moduleSlug: string, lessonSlug: string) {
  const p = getProgress();
  p.currentModule = moduleSlug;
  p.currentLesson = lessonSlug;
  if (!p.learningStartedAt) p.learningStartedAt = new Date().toISOString();
  saveProgress(p);
}

function buildModuleTitleKey(slug: string) {
  return `languages.russian.runtime.modules.${slug}.title`;
}

function buildModuleDescriptionKey(slug: string) {
  return `languages.russian.runtime.modules.${slug}.description`;
}

function buildLessonTitleKey(slug: string) {
  return `languages.russian.runtime.lessons.${slug}.title`;
}

function buildLessonObjective(slug: string) {
  return `languages.russian.runtime.lessons.${slug}.objective`;
}

function buildLessonContent(slug: string) {
  return `languages.russian.runtime.lessons.${slug}.content`;
}

export const ALL_RUSSIAN_MODULES: Module[] = russianRuntimeModules
  .map((module) => ({
    slug: module.slug,
    num: module.ordinal,
    titleKey: buildModuleTitleKey(module.slug),
    descKey: buildModuleDescriptionKey(module.slug),
    cefrLevel: module.cefr_band,
    moduleKey: module.module_key,
    lessons: russianRuntimeLessons
      .filter((lesson) => lesson.module_key === module.module_key)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((lesson) => ({
        slug: lesson.slug,
        lessonKey: lesson.lesson_key,
        titleKey: buildLessonTitleKey(lesson.slug),
        objectiveKey: buildLessonObjective(lesson.slug),
        contentKey: buildLessonContent(lesson.slug),
        vocabularyKeys: [],
        runtimeLesson: getRussianRuntimeLesson(lesson.slug),
      })),
  }));

/**
 * CEFR Level grouping for visual display
 */
export interface CEFRLevel {
  level: string;       // e.g. "A1"
  labelKey: string;    // i18n key
  modules: Module[];
}

/**
 * Group modules by CEFR band for timeline display
 */
export function getModulesByCEFR(modules: Module[]): CEFRLevel[] {
  const order = ['A0', 'A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2'];
  const map = new Map<string, Module[]>();
  for (const m of modules) {
    const band = m.cefrLevel || 'A1';
    if (!map.has(band)) map.set(band, []);
    map.get(band)!.push(m);
  }
  return order
    .filter(level => map.has(level))
    .map(level => ({
      level,
      labelKey: `languages.russian.cefr.${level.replace('+', '_plus')}`,
      modules: map.get(level)!,
    }));
}

/**
 * Filter modules based on resolved path.
 * Academic paths include all modules. General/conversational paths skip advanced academic modules.
 */
export function getModulesForPath(moduleSlugs: string[]): Module[] {
  if (!moduleSlugs.length) return ALL_RUSSIAN_MODULES;
  
  const slugSet = new Set(moduleSlugs);
  const filtered = ALL_RUSSIAN_MODULES.filter(m => slugSet.has(m.slug));
  
  // If filtering yields nothing (legacy paths), return all
  return filtered.length > 0 ? filtered : ALL_RUSSIAN_MODULES;
}

export function getAllLessonsFromModules(modules: Module[]): Lesson[] {
  return modules.flatMap((m) => m.lessons);
}

function getEntryIndex(modules: Module[], startModule?: string): number {
  if (!startModule) return 0;
  const modIdx = modules.findIndex((module) => module.slug === startModule || module.moduleKey === startModule);
  if (modIdx < 0) return 0;
  return getAllLessonsFromModules(modules.slice(0, modIdx)).length;
}

export function getNextLesson(currentSlug: string, modules: Module[]): Lesson | null {
  const all = getAllLessonsFromModules(modules);
  const idx = all.findIndex((l) => l.slug === currentSlug);
  return idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
}

export function getPreviousLesson(currentSlug: string, modules: Module[]): Lesson | null {
  const all = getAllLessonsFromModules(modules);
  const idx = all.findIndex((l) => l.slug === currentSlug);
  return idx > 0 ? all[idx - 1] : null;
}

export function isModuleUnlocked(moduleSlug: string, progress: LearningProgress, modules: Module[], startModule?: string): boolean {
  const modIdx = modules.findIndex((m) => m.slug === moduleSlug);
  if (modIdx < 0) return false;
  if (modIdx === 0) return true;
  if (startModule && modIdx <= modules.findIndex((m) => m.slug === startModule || m.moduleKey === startModule)) return true;
  const prevMod = modules[modIdx - 1];
  return prevMod.lessons.every((lesson) => progress.completedLessons.includes(lesson.slug));
}

export function isLessonAccessible(lessonSlug: string, progress: LearningProgress, modules: Module[], startModule?: string): boolean {
  const all = getAllLessonsFromModules(modules);
  const idx = all.findIndex((lesson) => lesson.slug === lessonSlug);
  if (idx < 0) return false;
  const entryIdx = getEntryIndex(modules, startModule);
  if (idx === entryIdx) return true;
  if (idx < entryIdx) return false;
  // A completed lesson is always accessible (allow revisiting)
  if (progress.completedLessons.includes(lessonSlug)) return true;
  return progress.completedLessons.includes(all[idx - 1].slug);
}

export function getResumePoint(progress: LearningProgress, modules: Module[], startModule?: string): { moduleSlug: string; lessonSlug: string } {
  const all = getAllLessonsFromModules(modules);
  const entryIdx = getEntryIndex(modules, startModule);

  if (
    progress.currentModule &&
    progress.currentLesson &&
    modules.some((module) => module.slug === progress.currentModule && module.lessons.some((lesson) => lesson.slug === progress.currentLesson)) &&
    isLessonAccessible(progress.currentLesson, progress, modules, startModule)
  ) {
    return { moduleSlug: progress.currentModule, lessonSlug: progress.currentLesson };
  }

  for (const lesson of all.slice(entryIdx)) {
    if (!progress.completedLessons.includes(lesson.slug)) {
      const mod = modules.find((module) => module.lessons.some((candidate) => candidate.slug === lesson.slug))!;
      return { moduleSlug: mod.slug, lessonSlug: lesson.slug };
    }
  }

  const fallbackLesson = all[entryIdx] ?? all[0];
  const fallbackModule = modules.find((module) => module.lessons.some((lesson) => lesson.slug === fallbackLesson.slug)) ?? modules[0];
  return { moduleSlug: fallbackModule.slug, lessonSlug: fallbackLesson.slug };
}
