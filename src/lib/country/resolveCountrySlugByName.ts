import { COUNTRY_NAMES } from '@/data/countryTranslations';

const normalizedToSlug = new Map<string, string>();

const normalize = (value: string) => value.trim().toLowerCase();

for (const [slug, names] of Object.entries(COUNTRY_NAMES)) {
  for (const localized of Object.values(names)) {
    normalizedToSlug.set(normalize(localized), slug);
  }
}

export function resolveCountrySlugByName(name?: string | null): string | null {
  if (!name) return null;
  return normalizedToSlug.get(normalize(name)) || null;
}
