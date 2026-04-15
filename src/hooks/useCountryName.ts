import { useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { COUNTRY_NAMES, SupportedLanguage } from '@/data/countryTranslations';

/**
 * Hook to get translated country names based on current language
 * Supports all 12 languages: ar, en, fr, ru, es, zh, hi, bn, pt, ja, de, ko
 */
export function useCountryName() {
  const { language } = useLanguage();

  /**
   * Get translated country name by slug
   * @param slug - Country slug from database (e.g., 'tr', 'usa', 'germany')
   * @param fallback - Optional fallback if translation not found
   * @returns Translated country name
   */
  const getCountryName = useCallback((slug: string, fallback?: string): string => {
    const lang = language as SupportedLanguage;
    return COUNTRY_NAMES[slug]?.[lang] 
      || COUNTRY_NAMES[slug]?.en 
      || fallback 
      || slug;
  }, [language]);

  /**
   * Get country name for a specific language (not current context language)
   * Useful when you need to display in a specific language regardless of UI language
   */
  const getCountryNameForLanguage = useCallback((
    slug: string, 
    targetLanguage: string, 
    fallback?: string
  ): string => {
    const lang = targetLanguage as SupportedLanguage;
    return COUNTRY_NAMES[slug]?.[lang] 
      || COUNTRY_NAMES[slug]?.en 
      || fallback 
      || slug;
  }, []);

  return { 
    getCountryName, 
    getCountryNameForLanguage,
    currentLanguage: language 
  };
}
