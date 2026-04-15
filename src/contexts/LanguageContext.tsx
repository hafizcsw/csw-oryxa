/**
 * LanguageContext - Adapter for react-i18next
 * 
 * This adapter maintains backwards compatibility with the 70+ components
 * that use useLanguage() while internally using i18next.
 * 
 * Migration: Components can gradually switch to useTranslation() directly.
 */

import { useTranslation } from 'react-i18next';
import type { Language } from '@/i18n/languages';

export type { Language };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: Record<string, unknown>) => any;
}

/**
 * Adapter hook - maintains same API as before
 * Internally uses i18next for translations
 */
export function useLanguage(): LanguageContextType {
  const { t: i18nT, i18n, ready } = useTranslation('common');
  
  return {
    language: (i18n.resolvedLanguage || i18n.language || 'en') as Language,
    setLanguage: (lang: Language) => i18n.changeLanguage(lang),
    t: (key: string, options?: Record<string, unknown>) => {
      if (!ready) {
        return options && (options as any).returnObjects ? [] : '';
      }
      return i18nT(key, options as any);
    },
  };
}

/**
 * Provider - now just a passthrough since i18next handles state
 * Kept for backwards compatibility with existing component tree
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
