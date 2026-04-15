import { useState, useCallback } from 'react';
import {
  compareProgramsV1,
  type CompareProgramsV1Response,
  type CompareProgramV1Item,
  type CompareAudience,
} from '@/lib/portalApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCompare, MAX_COMPARE } from '@/hooks/useCompare';

interface FetchComparisonOptions {
  locale?: string;
  audience?: CompareAudience;
  customList?: string[];
  syncNotFoundToCompare?: boolean;
}

export function useComparePrograms() {
  const { t, language } = useLanguage();
  const {
    compareList,
    addToCompare,
    removeFromCompare,
    isInCompare,
    clearCompare,
    count,
    replaceCompare,
    canCompare,
    maxReached,
  } = useCompare();
  const [comparisonData, setComparisonData] = useState<CompareProgramV1Item[] | null>(null);
  const [missingFields, setMissingFields] = useState<Record<string, string[]>>({});
  const [notFoundIds, setNotFoundIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async ({
    locale = language,
    audience = 'customer',
    customList,
    syncNotFoundToCompare = true,
  }: FetchComparisonOptions = {}): Promise<CompareProgramsV1Response | null> => {
    const programIds = customList ?? compareList;

    if (programIds.length < 2) {
      setError(t('hooks.compare.minPrograms'));
      setComparisonData(null);
      setMissingFields({});
      setNotFoundIds([]);
      return null;
    }

    setIsLoading(true);
    setError(null);
    setNotFoundIds([]);

    console.log('[COMPARE:UI] compare_fetch_start', {
      program_ids: programIds.length,
      locale,
      audience,
    });

    try {
      const response = await compareProgramsV1({ program_ids: programIds, locale, audience });

      if (!response.ok) {
        console.log('[COMPARE:UI] compare_fetch_fail', { error: response.error });
        setError(response.error || t('hooks.compare.fetchFailed'));
        setComparisonData(null);
        setMissingFields({});
        return null;
      }

      const nextNotFoundIds = response.not_found_ids ?? [];

      console.log('[COMPARE:UI] compare_fetch_ok', {
        found: response.programs.length,
        not_found: nextNotFoundIds.length,
        missing_fields_count: Object.keys(response.missing_fields).length,
      });

      setComparisonData(response.programs);
      setMissingFields(response.missing_fields);
      setNotFoundIds(nextNotFoundIds);

      if (syncNotFoundToCompare && nextNotFoundIds.length > 0) {
        const nextCompareList = programIds.filter((id) => !nextNotFoundIds.includes(id));
        replaceCompare(nextCompareList);
      }

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : t('hooks.compare.unexpectedError');
      console.log('[COMPARE:UI] compare_fetch_error', { error: message });
      setError(message);
      setComparisonData(null);
      setMissingFields({});
      setNotFoundIds([]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [compareList, language, replaceCompare, t]);

  const clearComparisonData = useCallback(() => {
    setComparisonData(null);
    setMissingFields({});
    setNotFoundIds([]);
    setError(null);
  }, []);

  const resetComparison = useCallback(() => {
    console.log('[COMPARE:UI] compare_reset');
    clearCompare();
    clearComparisonData();
  }, [clearCompare, clearComparisonData]);

  return {
    compareList,
    count,
    addToCompare,
    removeFromCompare,
    isInCompare,
    clearCompare,
    replaceCompare,
    canCompare,
    maxReached,
    maxCompare: MAX_COMPARE,
    comparisonData,
    missingFields,
    notFoundIds,
    isLoading,
    error,
    fetchComparison,
    clearComparisonData,
    resetComparison,
  };
}
