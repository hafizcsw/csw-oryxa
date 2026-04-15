/**
 * Hook: useDeterministicLocalizer
 * 
 * Uses a STATIC glossary dictionary (no DB query, no RLS bypass).
 * Exposes localizeTitle() for deterministic program title translation.
 * 
 * Architecture:
 * - Glossary source: src/data/academicGlossary.ts (static artifact)
 * - No runtime DB fetch — zero network overhead
 * - No RLS violation — glossary table stays admin-only
 * - Dictionary updates require code change (intentional governance)
 * 
 * Production rules:
 * - HIGH confidence (≥70%) → show Arabic
 * - LOW confidence (<70%) → keep English (fallback)
 * - NEVER writes to DB — display-time only
 */
import { useCallback, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  buildGlossaryMap,
  localizeTitle,
  type LocalizationResult,
} from '@/utils/deterministicLocalizer';
import { ACADEMIC_GLOSSARY_EN_AR } from '@/data/academicGlossary';

export function useDeterministicLocalizer() {
  const { language } = useLanguage();

  // Build map once from static data — no query needed
  const glossaryMap = useMemo(
    () => buildGlossaryMap(ACADEMIC_GLOSSARY_EN_AR),
    []
  );

  const localize = useCallback(
    (title: string): LocalizationResult => {
      if (language !== 'ar') {
        return {
          original: title,
          localized: null,
          confidence: 0,
          level: 'LOW',
          matchedTokens: [],
          unmatchedTokens: [title],
        };
      }
      return localizeTitle(title, glossaryMap);
    },
    [language, glossaryMap]
  );

  return { localize, isReady: true };
}
