import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';

// Lazy-glob: returns Promises, NOT eager objects.
// Vite emits one chunk per JSON file → only the active language(s) are downloaded.
// This removes ~5.9MB of locale JSON from the initial bundle.
const localeLoaders = import.meta.glob('../locales/*/*.json') as Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
>;

// Build a (lng, ns) → loader map for fast lookup.
const loaderIndex = new Map<string, () => Promise<{ default: Record<string, unknown> }>>();
for (const [path, loader] of Object.entries(localeLoaders)) {
  const match = path.match(/\.\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  if (!match) continue;
  const [, lng, ns] = match;
  loaderIndex.set(`${lng}/${ns}`, loader);
}

i18n
  .use(LanguageDetector)
  .use(
    resourcesToBackend(async (lng: string, ns: string) => {
      const loader = loaderIndex.get(`${lng}/${ns}`);
      if (!loader) {
        if (import.meta.env.DEV) {
          console.warn(`[i18n] Missing locale chunk: ${lng}/${ns}`);
        }
        return {};
      }
      try {
        const mod = await loader();
        return (mod.default ?? mod) as Record<string, unknown>;
      } catch (err) {
        console.error(`[i18n] Failed to load ${lng}/${ns}`, err);
        return {};
      }
    })
  )
  .use(initReactI18next)
  .init({
    supportedLngs: ['en', 'ar', 'fr', 'ru', 'es', 'zh', 'hi', 'bn', 'pt', 'ja', 'de', 'ko'],
    fallbackLng: 'en',
    ns: ['common', 'translation', 'forInstitutions'],
    defaultNS: 'common',
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,

    // Don't preload anything except what the detector picks.
    // Suspense will wait for the active language's namespaces on first paint.
    partialBundledLanguages: true,

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'app_language',
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: true,
    },

    returnNull: false,
    returnEmptyString: false,

    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (lng: string[], ns: string, key: string) => {
          console.warn(`[i18n] Missing key: ${key} (ns: ${ns}, lng: ${lng})`);
        }
      : undefined,
  });

export default i18n;
