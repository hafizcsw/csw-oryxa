import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Eager import all locale files
const localeModules = import.meta.glob('../locales/*/*.json', { eager: true }) as Record<string, { default: Record<string, unknown> }>;

// Build resources object from glob
const resources: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [path, mod] of Object.entries(localeModules)) {
  // path format: ../locales/{lng}/{ns}.json
  const match = path.match(/\.\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  if (!match) continue;
  const [, lng, ns] = match;
  if (!resources[lng]) resources[lng] = {};
  resources[lng][ns] = (mod.default ?? mod) as Record<string, unknown>;
}

if (import.meta.env.DEV) {
  console.log('[i18n] Loaded resources:', Object.keys(resources).map(lng => 
    `${lng}: [${Object.keys(resources[lng]).join(', ')}]`
  ));
  // Verify admin.door2 exists
  const enCommon = resources['en']?.['common'] as any;
  console.log('[i18n] en/common has admin?', !!enCommon?.admin, 'admin.door2?', !!enCommon?.admin?.door2);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: ['en', 'ar', 'fr', 'ru', 'es', 'zh', 'hi', 'bn', 'pt', 'ja', 'de', 'ko'],
    fallbackLng: 'en',
    ns: ['common', 'translation', 'forInstitutions'],
    defaultNS: 'common',
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'app_language',
    },
    
    interpolation: { 
      escapeValue: false
    },
    
    react: { 
      useSuspense: true 
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
