// Canonicalization helpers for Program Search (V2 Contract)
// Goal: NEVER send garbage values to the API.
// - Prefer mapping common UI slugs/labels → canonical codes
// - Otherwise DROP invalid values

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO2_RE = /^[A-Z]{2}$/;
const LANG_RE = /^[a-z]{2}(-[a-z]{2})?$/;
const SLUG_RE = /^[a-z]+(?:[a-z0-9_-]*[a-z0-9])?$/;

// Based on live data in vw_program_search_api_v3_final (Jan 2026)
const DEGREE_SLUG_ALLOWLIST = new Set(['bachelor', 'master', 'phd']);

// Country mapping: UI slugs/labels → ISO2 used by the search view
// NOTE: The view uses GB (not UK).
const COUNTRY_SLUG_TO_CODE: Record<string, string> = {
  // canonical-ish slugs
  tr: 'TR',
  turkey: 'TR',

  ru: 'RU',
  russia: 'RU',

  de: 'DE',
  germany: 'DE',

  es: 'ES',
  spain: 'ES',

  gb: 'GB',
  uk: 'GB',
  'united-kingdom': 'GB',
  'united kingdom': 'GB',

  us: 'US',
  usa: 'US',
  'united-states': 'US',
  'united states': 'US',

  sg: 'SG',
  singapore: 'SG',

  kr: 'KR',
  korea: 'KR',
  'south-korea': 'KR',
  'south korea': 'KR',

  jp: 'JP',
  japan: 'JP',
};

// Language mapping: UI labels → ISO codes stored in instruction_languages[]
const LANGUAGE_LABEL_TO_CODE: Record<string, string> = {
  // English labels
  english: 'en',
  arabic: 'ar',
  turkish: 'tr',
  russian: 'ru',
  german: 'de',
  spanish: 'es',
  japanese: 'ja',
  korean: 'ko',
  french: 'fr',
  italian: 'it',

  // Common Arabic labels
  'الانجليزية': 'en',
  'الإنجليزية': 'en',
  'عربي': 'ar',
  'العربية': 'ar',
  'التركية': 'tr',
  'الروسية': 'ru',
  'الألمانية': 'de',
  'الاسبانية': 'es',
  'الإسبانية': 'es',
  'اليابانية': 'ja',
  'الكورية': 'ko',
};

export function canonicalizeCountryCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  // already ISO2
  const maybeIso2 = raw.toUpperCase();
  if (ISO2_RE.test(maybeIso2)) return maybeIso2;

  const key = raw.toLowerCase();
  const mapped = COUNTRY_SLUG_TO_CODE[key];
  return mapped && ISO2_RE.test(mapped) ? mapped : undefined;
}

export function canonicalizeDegreeSlugOrId(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  // If it's a UUID, the backend resolver will convert it to slug.
  if (typeof value === 'string' && UUID_RE.test(value.trim())) {
    return value.trim();
  }

  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  const v = raw.toLowerCase();

  // label→slug mapping (safe)
  const labelMap: Record<string, string> = {
    bachelor: 'bachelor',
    bachelors: 'bachelor',
    undergraduate: 'bachelor',
    undergrad: 'bachelor',

    master: 'master',
    masters: 'master',
    postgraduate: 'master',
    postgrad: 'master',

    phd: 'phd',
    doctorate: 'phd',
    doctor: 'phd',
  };

  const mapped = labelMap[v] ?? v;
  return DEGREE_SLUG_ALLOWLIST.has(mapped) ? mapped : undefined;
}

export function canonicalizeDisciplineSlug(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  // DO NOT allow UUIDs here (backend does not resolve discipline id)
  if (UUID_RE.test(raw)) return undefined;

  const slug = raw.toLowerCase();
  return SLUG_RE.test(slug) ? slug : undefined;
}

export function canonicalizeInstructionLanguages(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;

  const arr = Array.isArray(value) ? value : [value];
  const out: string[] = [];

  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const raw = item.trim();
    if (!raw) continue;

    const lower = raw.toLowerCase();
    const mapped = LANGUAGE_LABEL_TO_CODE[lower] ?? lower;

    if (LANG_RE.test(mapped)) out.push(mapped);
  }

  return out.length > 0 ? Array.from(new Set(out)) : undefined;
}
