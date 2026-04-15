import {
  getLanguageCourseDashboardRoute,
  getLanguageCoursePlanRoute,
  getLanguageCoursePlacementAuthRoute,
  getLanguageCoursePlacementTestRoute,
} from '@/lib/languageCourseConfig';

export const buildLanguageCourseStorageKey = (languageKey: string, suffix: 'onboarding' | 'active_state') =>
  `languages_${languageKey}_${suffix}`;

export const getLanguageCourseOnboardingStorageKey = (languageKey: string) => buildLanguageCourseStorageKey(languageKey, 'onboarding');

export const persistActiveLearningState = (languageKey: string, pathKey: string | null) => {
  localStorage.setItem('active_learning_state', JSON.stringify({
    active_learning_type: 'language',
    active_learning_language: languageKey,
    active_learning_path: pathKey,
    active_learning_dashboard_route: getLanguageCourseDashboardRoute(languageKey),
  }));
};

export const getLanguageCourseAuthRedirect = (languageKey: string) => getLanguageCoursePlacementTestRoute(languageKey);
export const getLanguageCoursePaymentRoute = (languageKey: string) => `${getLanguageCoursePlanRoute(languageKey).replace('/plan', '')}#pricing-section`;
export const getLanguageCoursePlacementEntryRoute = (languageKey: string, isAuthenticated: boolean) =>
  isAuthenticated ? getLanguageCoursePlacementTestRoute(languageKey) : getLanguageCoursePlacementAuthRoute(languageKey);
