import { ALL_RUSSIAN_MODULES, getAllLessonsFromModules, type Lesson, type Module } from '@/lib/russianCourse';

export interface CurriculumPosition {
  moduleSlug: string | null;
  lessonSlug: string | null;
  moduleIndex: number;
  lessonIndex: number;
  absoluteIndex: number;
  previousLesson: Lesson | null;
  nextLesson: Lesson | null;
  unlockedLessonSlugs: string[];
  lockedLessonSlugs: string[];
  totalLessons: number;
}

export function getRussianCurriculumModules(): Module[] {
  return ALL_RUSSIAN_MODULES;
}

export function resolveCurriculumPosition(params: {
  moduleSlug?: string | null;
  lessonSlug?: string | null;
  completedLessonSlugs?: string[];
}): CurriculumPosition {
  const modules = getRussianCurriculumModules();
  const lessons = getAllLessonsFromModules(modules);
  const completed = new Set(params.completedLessonSlugs || []);

  const absoluteIndex = lessons.findIndex((lesson) => lesson.slug === params.lessonSlug);
  const moduleIndex = modules.findIndex((module) => module.slug === params.moduleSlug);
  const lessonIndex = absoluteIndex >= 0
    ? modules[Math.max(moduleIndex, 0)]?.lessons.findIndex((lesson) => lesson.slug === params.lessonSlug) ?? -1
    : -1;

  const previousLesson = absoluteIndex > 0 ? lessons[absoluteIndex - 1] : null;
  const nextLesson = absoluteIndex >= 0 && absoluteIndex < lessons.length - 1 ? lessons[absoluteIndex + 1] : null;

  const unlockedLessonSlugs: string[] = [];
  const lockedLessonSlugs: string[] = [];

  lessons.forEach((lesson, idx) => {
    const isUnlocked = idx === 0 || completed.has(lessons[idx - 1].slug) || completed.has(lesson.slug);
    if (isUnlocked) unlockedLessonSlugs.push(lesson.slug);
    else lockedLessonSlugs.push(lesson.slug);
  });

  return {
    moduleSlug: params.moduleSlug || null,
    lessonSlug: params.lessonSlug || null,
    moduleIndex,
    lessonIndex,
    absoluteIndex,
    previousLesson,
    nextLesson,
    unlockedLessonSlugs,
    lockedLessonSlugs,
    totalLessons: lessons.length,
  };
}

export function listLessonsForModule(moduleSlug: string): Lesson[] {
  const module = getRussianCurriculumModules().find((item) => item.slug === moduleSlug);
  return module?.lessons || [];
}
