/**
 * Deterministic Program Title Localizer
 * 
 * Translates structured program titles EN→AR using glossary token matching.
 * NO AI dependency. Works entirely client-side with cached glossary data.
 * 
 * Strategy:
 * 1. Try EXACT match first (full title in glossary)
 * 2. Try MULTI-WORD phrase match (longest match first)
 * 3. Try SINGLE-WORD token match
 * 4. Confidence = matched_chars / total_chars
 *    - HIGH (≥0.7) → auto-use
 *    - LOW (<0.7) → return null (fallback to EN)
 */

export interface LocalizationResult {
  original: string;
  localized: string | null;
  confidence: number;
  level: 'HIGH' | 'LOW';
  matchedTokens: string[];
  unmatchedTokens: string[];
}

// Glossary entry from DB
export interface GlossaryEntry {
  source_text: string;
  target_text: string;
  preserve_rule?: string | null;
}

// Noise words to strip from titles before matching
const NOISE_WORDS = new Set([
  'a', 'an', 'the', 'in', 'of', 'for', 'with', 'on', 'at', 'to', 'by',
  'from', 'its', 'their', 'our', 'your', 'his', 'her',
  '&', '-', '–', '—', '/', '(', ')', ',', ':', ';',
  'hons', 'bsc', 'ba', 'msc', 'ma', 'mba', 'llb', 'llm', 'beng', 'meng',
  'top-up', 'top', 'up', 'with', 'year', 'foundation',
]);

// Arabic connectors for joining
const AR_CONNECTOR = ' ';

/**
 * Build a lookup map from glossary entries.
 * Keys are lowercase source_text for case-insensitive matching.
 * Sorted by source_text length DESC so longest phrases match first.
 */
export function buildGlossaryMap(entries: GlossaryEntry[]): Map<string, GlossaryEntry> {
  const map = new Map<string, GlossaryEntry>();
  // Sort by length descending so multi-word phrases are checked first
  const sorted = [...entries].sort((a, b) => b.source_text.length - a.source_text.length);
  for (const entry of sorted) {
    map.set(entry.source_text.toLowerCase(), entry);
  }
  return map;
}

/**
 * Clean a title: remove degree prefixes, parenthetical campus info, etc.
 */
function cleanTitle(title: string): string {
  return title
    // Remove leading degree markers like "\(Hons) \""
    .replace(/^\(Hons\)\s*/i, '')
    // Remove campus/location parentheticals like "(Zhuhai, UIC campus)"
    .replace(/\([^)]*campus[^)]*\)\s*/gi, '')
    // Remove degree abbreviations at start like "BSc ", "MA ", "MSc "
    .replace(/^(B\.?Sc\.?|B\.?A\.?|M\.?Sc\.?|M\.?A\.?|MBA|M\.?Eng\.?|B\.?Eng\.?|LL\.?B\.?|LL\.?M\.?|Ph\.?D\.?)\s+/i, '')
    // Remove "in " prefix after degree
    .replace(/^in\s+/i, '')
    // Remove trailing " - specialization" patterns
    // Keep the main discipline
    .trim();
}

/**
 * Localize a single program title deterministically.
 */
export function localizeTitle(
  title: string,
  glossaryMap: Map<string, GlossaryEntry>,
  degreeName?: { en?: string; ar?: string }
): LocalizationResult {
  const cleaned = cleanTitle(title);
  const lowerCleaned = cleaned.toLowerCase();
  
  // 1. EXACT MATCH — full title exists in glossary
  const exact = glossaryMap.get(lowerCleaned);
  if (exact) {
    const localized = exact.preserve_rule === 'preserve' || exact.preserve_rule === 'keep_original'
      ? exact.source_text
      : exact.target_text;
    return {
      original: title,
      localized,
      confidence: 1.0,
      level: 'HIGH',
      matchedTokens: [cleaned],
      unmatchedTokens: [],
    };
  }

  // 2. PHRASE + TOKEN MATCH
  // Try to match longest glossary phrases first, then individual words
  let remaining = lowerCleaned;
  const matchedParts: string[] = [];
  const matchedTokens: string[] = [];
  let matchedCharCount = 0;

  // Sort glossary entries by source_text length (longest first) for greedy matching
  const sortedEntries = Array.from(glossaryMap.entries())
    .sort(([a], [b]) => b.length - a.length);

  for (const [sourceKey, entry] of sortedEntries) {
    if (sourceKey.length < 2) continue; // skip single chars
    
    // Check if this phrase exists in remaining text (word-boundary aware)
    const regex = new RegExp(`\\b${escapeRegex(sourceKey)}\\b`, 'gi');
    if (regex.test(remaining)) {
      const arText = entry.preserve_rule === 'preserve' || entry.preserve_rule === 'keep_original'
        ? entry.source_text
        : entry.target_text;
      matchedParts.push(arText);
      matchedTokens.push(sourceKey);
      matchedCharCount += sourceKey.length;
      // Remove matched portion
      remaining = remaining.replace(regex, '').replace(/\s+/g, ' ').trim();
    }
  }

  // Count meaningful remaining chars (exclude noise words and punctuation)
  const remainingTokens = remaining.split(/\s+/).filter(t => t.length > 0);
  const unmatchedTokens = remainingTokens.filter(t => !NOISE_WORDS.has(t.toLowerCase()));
  const totalMeaningfulChars = lowerCleaned.split(/\s+/)
    .filter(t => !NOISE_WORDS.has(t.toLowerCase()))
    .join(' ').length;

  const confidence = totalMeaningfulChars > 0
    ? matchedCharCount / totalMeaningfulChars
    : 0;

  const level = confidence >= 0.7 ? 'HIGH' : 'LOW';

  if (matchedParts.length === 0 || level === 'LOW') {
    return {
      original: title,
      localized: null,
      confidence,
      level: 'LOW',
      matchedTokens,
      unmatchedTokens,
    };
  }

  // Join Arabic parts
  const localized = matchedParts.join(AR_CONNECTOR);

  return {
    original: title,
    localized,
    confidence,
    level,
    matchedTokens,
    unmatchedTokens,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
