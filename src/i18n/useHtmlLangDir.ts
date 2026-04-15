import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getLanguageDirection, resolveLanguage } from './languages';

/**
 * Hook to sync document language and direction with i18next
 * Supports RTL languages: Arabic, Urdu, Farsi, Hebrew
 */
export function useHtmlLangDir() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const resolved = i18n.resolvedLanguage || i18n.language || 'en';
    const lng = resolveLanguage(resolved);
    document.documentElement.lang = lng;
    document.documentElement.dir = getLanguageDirection(lng);
  }, [i18n, i18n.resolvedLanguage, i18n.language]);
}
