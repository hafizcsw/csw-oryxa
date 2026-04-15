// Simple language detection utilities

/**
 * Detect language from HTML content
 */
export function detectLanguage(html: string, markdown?: string): string {
  // Priority 1: Check HTML lang attribute
  const htmlLangMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  if (htmlLangMatch) {
    const lang = htmlLangMatch[1].split('-')[0].toLowerCase();
    return lang;
  }
  
  // Priority 2: Check meta tag
  const metaLangMatch = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+http-equiv=["']content-language["']/i);
  if (metaLangMatch) {
    const lang = metaLangMatch[1].split('-')[0].toLowerCase();
    return lang;
  }
  
  // Priority 3: Content-based detection
  const text = (markdown || html).toLowerCase();
  
  // Arabic detection (simple heuristic based on character frequency)
  const arabicChars = text.match(/[\u0600-\u06FF]/g);
  if (arabicChars && arabicChars.length > 50) {
    return 'ar';
  }
  
  // Russian detection
  const russianChars = text.match(/[\u0400-\u04FF]/g);
  if (russianChars && russianChars.length > 50) {
    return 'ru';
  }
  
  // German detection (common words)
  const germanWords = ['und', 'der', 'die', 'das', 'für', 'von', 'mit', 'zum', 'zur'];
  const germanCount = germanWords.reduce((count, word) => {
    const matches = text.match(new RegExp(`\\b${word}\\b`, 'gi'));
    return count + (matches ? matches.length : 0);
  }, 0);
  if (germanCount > 10) return 'de';
  
  // French detection
  const frenchWords = ['le', 'la', 'les', 'de', 'des', 'et', 'pour', 'avec'];
  const frenchCount = frenchWords.reduce((count, word) => {
    const matches = text.match(new RegExp(`\\b${word}\\b`, 'gi'));
    return count + (matches ? matches.length : 0);
  }, 0);
  if (frenchCount > 10) return 'fr';
  
  // Spanish detection
  const spanishWords = ['el', 'la', 'los', 'las', 'de', 'del', 'y', 'para', 'con'];
  const spanishCount = spanishWords.reduce((count, word) => {
    const matches = text.match(new RegExp(`\\b${word}\\b`, 'gi'));
    return count + (matches ? matches.length : 0);
  }, 0);
  if (spanishCount > 10) return 'es';
  
  // Turkish detection
  const turkishChars = text.match(/[ğüşıöç]/g);
  if (turkishChars && turkishChars.length > 10) {
    return 'tr';
  }
  
  // Default to English
  return 'en';
}

/**
 * Check if text is in one of the expected languages
 */
export function isExpectedLanguage(text: string, expectedLocales: string[]): boolean {
  const detected = detectLanguage(text);
  return expectedLocales.includes(detected);
}
