/**
 * Glossary Helper — provides glossary-aware prompt construction
 * for the translation pipeline.
 * 
 * Fetches relevant terms from `translation_glossary` and formats
 * them as translation constraints for AI prompts.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface GlossaryTerm {
  term_key: string;
  source_text: string;
  target_text: string;
  source_locale: string;
  target_locale: string;
  preserve_rule: string | null;
  domain: string | null;
}

/**
 * Fetch glossary terms relevant for a given locale pair and optional domain.
 */
export async function fetchGlossaryTerms(
  supabase: ReturnType<typeof createClient>,
  sourceLocale: string,
  targetLocale: string,
  domain?: string,
  limit = 100
): Promise<GlossaryTerm[]> {
  // Fetch all glossary terms for locale pair — domain is used for filtering post-hoc if needed
  // This ensures we always get general terms plus domain-specific ones
  const { data, error } = await supabase
    .from('translation_glossary')
    .select('term_key, source_text, target_text, source_locale, target_locale, preserve_rule, domain')
    .eq('source_locale', sourceLocale)
    .eq('target_locale', targetLocale)
    .limit(limit);

  if (error) {
    console.warn('[glossaryHelper] Error fetching glossary:', error.message);
    return [];
  }

  // If domain specified, prioritize domain-matching terms + null-domain (general) terms
  if (domain && data) {
    return data.filter(t => !t.domain || t.domain === domain || t.domain === 'higher-ed');
  }

  return data || [];
}

/**
 * Format glossary terms into a constraint block for AI translation prompts.
 */
export function formatGlossaryForPrompt(terms: GlossaryTerm[]): string {
  if (terms.length === 0) return '';

  const lines: string[] = ['GLOSSARY CONSTRAINTS (must follow exactly):'];
  
  for (const term of terms) {
    if (term.preserve_rule === 'keep_original' || term.preserve_rule === 'preserve') {
      lines.push(`- "${term.source_text}" → preserve as-is (${term.domain || 'proper noun'})`);
    } else if (term.preserve_rule === 'transliterate') {
      lines.push(`- "${term.source_text}" → transliterate to "${term.target_text}"`);
    } else {
      lines.push(`- "${term.source_text}" → "${term.target_text}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Build a glossary-aware translation prompt block.
 */
export async function buildGlossaryPromptBlock(
  supabase: ReturnType<typeof createClient>,
  sourceLocale: string,
  targetLocale: string,
  domain?: string
): Promise<string> {
  const terms = await fetchGlossaryTerms(supabase, sourceLocale, targetLocale, domain);
  return formatGlossaryForPrompt(terms);
}
