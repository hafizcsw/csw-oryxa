import { useLanguage } from '@/contexts/LanguageContext';
import { useCallback } from 'react';
import { hasLegacyLocaleValue, resolveLocalizedField } from '@/lib/localization/displayAdapter';

/**
 * Hook for locale-safe field access from mixed payloads.
 *
 * Resolution order:
 * 1) resolver/display contract (`locale.display[field]`, then `display[field]`)
 * 2) legacy suffix compatibility (`field_<locale>`, `field_en`, `field_ar`)
 * 3) base field (`field`)
 */
export function useLocalizedField() {
  const { language } = useLanguage();

  const getField = useCallback(
    (item: Record<string, any> | null | undefined, field: string): string => {
      return resolveLocalizedField(item, field, language).value;
    },
    [language]
  );

  const getFieldMeta = useCallback(
    (item: Record<string, any> | null | undefined, field: string) => {
      return resolveLocalizedField(item, field, language);
    },
    [language]
  );

  const hasLegacyNativeField = useCallback(
    (item: Record<string, any> | null | undefined, field: string) => {
      return hasLegacyLocaleValue(item, field, language);
    },
    [language]
  );

  const isResolverDisplaySource = useCallback(
    (item: Record<string, any> | null | undefined, field: string): boolean => {
      const source = resolveLocalizedField(item, field, language).source;
      return source === 'locale.display' || source === 'display';
    },
    [language]
  );

  return { getField, getFieldMeta, hasLegacyNativeField, isResolverDisplaySource, language };
}
