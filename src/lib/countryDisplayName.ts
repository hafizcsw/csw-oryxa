/**
 * Resolve a country's display name in the active locale using the browser's
 * Intl.DisplayNames API.  Falls back to the DB-stored ar/en names when the
 * API is unavailable or the code is unrecognised.
 *
 * Supports all 12 project languages out of the box — no DB columns needed.
 */

const LOCALE_MAP: Record<string, string> = {
  ar: "ar",
  en: "en",
  fr: "fr",
  de: "de",
  es: "es",
  pt: "pt",
  ru: "ru",
  zh: "zh",
  ja: "ja",
  ko: "ko",
  hi: "hi",
  bn: "bn",
};

// Module-level cache: one DisplayNames instance per locale
const cache = new Map<string, Intl.DisplayNames>();

function getDisplayNames(locale: string): Intl.DisplayNames | null {
  const mapped = LOCALE_MAP[locale] ?? locale;
  if (cache.has(mapped)) return cache.get(mapped)!;
  try {
    const dn = new Intl.DisplayNames([mapped], { type: "region" });
    cache.set(mapped, dn);
    return dn;
  } catch {
    return null;
  }
}

/**
 * Get country name for a given ISO-3166-1 alpha-2 code in the specified language.
 * @param countryCode  Two-letter country code (e.g. "US", "RU")
 * @param language     Active UI language key (e.g. "ja", "ar")
 * @param fallbackAr   Optional DB-stored Arabic name
 * @param fallbackEn   Optional DB-stored English name
 */
export function getLocalizedCountryName(
  countryCode: string,
  language: string,
  fallbackAr?: string | null,
  fallbackEn?: string | null,
): string {
  // Special-case Palestine (our canonical code PS)
  const code = countryCode.toUpperCase();

  const dn = getDisplayNames(language);
  if (dn) {
    try {
      const name = dn.of(code);
      if (name && name !== code) return name;
    } catch { /* code not recognised — fall through */ }
  }

  // Fallback chain: active lang DB → en → ar → code
  if (language === "ar" && fallbackAr) return fallbackAr;
  if (language === "en" && fallbackEn) return fallbackEn;
  if (fallbackEn) return fallbackEn;
  if (fallbackAr) return fallbackAr;
  return code;
}
