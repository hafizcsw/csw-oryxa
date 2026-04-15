export type LanguageCourseKey = 'russian' | 'english' | 'turkish' | 'french' | 'german' | 'chinese';

export interface LanguageCourseDefinition {
  key: LanguageCourseKey;
  flag: string;
  catalogNameKey: string;
  catalogDescKey: string;
  hasRuntime: boolean;
}

export const LANGUAGE_COURSE_DEFINITIONS: Record<LanguageCourseKey, LanguageCourseDefinition> = {
  russian: {
    key: 'russian',
    flag: '🇷🇺',
    catalogNameKey: 'languages.catalog.russian.name',
    catalogDescKey: 'languages.catalog.russian.desc',
    hasRuntime: true,
  },
  english: { key: 'english', flag: '🇬🇧', catalogNameKey: 'languages.catalog.english.name', catalogDescKey: 'languages.catalog.english.desc', hasRuntime: false },
  turkish: { key: 'turkish', flag: '🇹🇷', catalogNameKey: 'languages.catalog.turkish.name', catalogDescKey: 'languages.catalog.turkish.desc', hasRuntime: false },
  french: { key: 'french', flag: '🇫🇷', catalogNameKey: 'languages.catalog.french.name', catalogDescKey: 'languages.catalog.french.desc', hasRuntime: false },
  german: { key: 'german', flag: '🇩🇪', catalogNameKey: 'languages.catalog.german.name', catalogDescKey: 'languages.catalog.german.desc', hasRuntime: false },
  chinese: { key: 'chinese', flag: '🇨🇳', catalogNameKey: 'languages.catalog.chinese.name', catalogDescKey: 'languages.catalog.chinese.desc', hasRuntime: false },
};

export const getLanguageCourseDefinition = (languageKey: string) =>
  LANGUAGE_COURSE_DEFINITIONS[languageKey as LanguageCourseKey] ?? null;

export const getLanguageCourseBaseRoute = (languageKey: string) => `/languages/${languageKey}`;
export const getLanguageCourseOnboardingRoute = (languageKey: string) => `${getLanguageCourseBaseRoute(languageKey)}/onboarding`;
export const getLanguageCoursePlanRoute = (languageKey: string) => `${getLanguageCourseBaseRoute(languageKey)}/plan`;
export const getLanguageCourseDashboardRoute = (languageKey: string) => `${getLanguageCourseBaseRoute(languageKey)}/dashboard`;
export const getLanguageCoursePlacementAuthRoute = (languageKey: string) => `${getLanguageCourseBaseRoute(languageKey)}/placement-auth`;
export const getLanguageCoursePlacementTestRoute = (languageKey: string) => `${getLanguageCourseBaseRoute(languageKey)}/placement-test`;
export const getLanguageCourseModuleRoute = (languageKey: string, moduleSlug: string) => `${getLanguageCourseBaseRoute(languageKey)}/modules/${moduleSlug}`;
export const getLanguageCourseLessonRoute = (languageKey: string, lessonSlug: string) => `${getLanguageCourseBaseRoute(languageKey)}/lessons/${lessonSlug}`;
export const getLanguageCourseCheckpointRoute = (languageKey: string, templateKey: string) => `${getLanguageCourseBaseRoute(languageKey)}/checkpoints/${templateKey}`;
export const getLanguageCourseExamRoute = (languageKey: string, examSetKey: string) => `${getLanguageCourseBaseRoute(languageKey)}/exams/${examSetKey}`;
