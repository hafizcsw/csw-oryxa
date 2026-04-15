import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Hook to consume resolver-backed locale data from API responses.
 * 
 * The API returns a `locale` object when a locale param is sent:
 * {
 *   locale_requested: "ar",
 *   locale_served: "ar",
 *   fallback_used: false,
 *   display: { name: "...", description: "...", country_name: "..." },
 *   _meta: { fields_resolved: 3, resolution_details: { ... } }
 * }
 * 
 * This hook provides:
 * - `locale`: current language code to send to the API
 * - `getDisplay(localeData, field, fallback)`: get resolved field or fallback
 * - `getMeta(localeData)`: get resolution metadata
 */
export function useLocalizedContent() {
  const { language } = useLanguage();

  const helpers = useMemo(() => ({
    /**
     * Get a display field from the locale resolution, with fallback.
     * @param localeData - The `locale` object from the API response (may be null)
     * @param field - Field name in display.* (e.g. 'name', 'description', 'country_name')
     * @param fallback - Fallback value if locale data is unavailable
     */
    getDisplay: (localeData: any, field: string, fallback?: string): string => {
      return localeData?.display?.[field] || fallback || '';
    },

    /**
     * Get resolution metadata for transparency/debugging.
     */
    getMeta: (localeData: any) => {
      if (!localeData) return null;
      return {
        localeRequested: localeData.locale_requested,
        localeServed: localeData.locale_served,
        fallbackUsed: localeData.fallback_used,
        fieldsResolved: localeData._meta?.fields_resolved || 0,
        details: localeData._meta?.resolution_details || {},
      };
    },

    /**
     * Check if a specific field was served from the requested locale (not fallback).
     */
    isNativeLocale: (localeData: any, field: string): boolean => {
      const detail = localeData?._meta?.resolution_details?.[field];
      return detail ? !detail.fallback_used : false;
    },
  }), []);

  return {
    locale: language,
    ...helpers,
  };
}
