// Supported languages in the application
export type Language = 'en' | 'ar' | 'fr' | 'ru' | 'es' | 'zh' | 'hi' | 'bn' | 'pt' | 'ja' | 'de' | 'ko';

export const SUPPORTED_LANGUAGES: Language[] = [
  'en', 'ar', 'fr', 'ru', 'es', 'zh', 'hi', 'bn', 'pt', 'ja', 'de', 'ko'
];

export type LanguageDirection = 'ltr' | 'rtl';

// Language metadata for UI + locale capabilities
export const LANGUAGE_INFO: Record<Language, { name: string; nativeName: string; flag: string; dir: LanguageDirection }> = {
  en: { name: 'English', nativeName: 'English', flag: '🇬🇧', dir: 'ltr' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', dir: 'ltr' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', dir: 'ltr' },
  zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳', dir: 'ltr' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', dir: 'ltr' },
  bn: { name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', dir: 'ltr' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', dir: 'ltr' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', dir: 'ltr' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷', dir: 'ltr' },
};


export const RTL_LANGUAGES: Language[] = SUPPORTED_LANGUAGES.filter((language) => LANGUAGE_INFO[language].dir === 'rtl');

export function resolveLanguage(candidate?: string | null): Language {
  const normalized = (candidate || 'en').replace('_', '-').split('-')[0].toLowerCase() as Language;
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : 'en';
}

export function getLanguageDirection(candidate?: string | null): LanguageDirection {
  return LANGUAGE_INFO[resolveLanguage(candidate)].dir;
}

export function isRtlLanguage(candidate?: string | null): boolean {
  return getLanguageDirection(candidate) === 'rtl';
}
