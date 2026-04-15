export type LocalizedLike = {
  locale?: {
    display?: Record<string, unknown>;
  } | null;
  display?: Record<string, unknown> | null;
  [key: string]: unknown;
};


export type LegacySource = 'legacy_exact' | 'legacy_primary' | 'legacy_en' | 'legacy_ar';

function isLegacySource(source: ResolvedFieldMeta['source']): source is LegacySource {
  return source === 'legacy_exact' || source === 'legacy_primary' || source === 'legacy_en' || source === 'legacy_ar';
}

export type ResolvedFieldMeta = {
  value: string;
  source:
    | 'locale.display'
    | 'display'
    | 'legacy_exact'
    | 'legacy_primary'
    | 'legacy_en'
    | 'legacy_ar'
    | 'base'
    | 'empty';
};

function asText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed;
}

function primaryLocale(locale: string): string {
  return (locale || 'en').replace('_', '-').split('-')[0].toLowerCase();
}

function localeVariants(locale: string): string[] {
  const raw = (locale || 'en').toLowerCase();
  const hyphen = raw.replace(/_/g, '-');
  const underscore = hyphen.replace(/-/g, '_');
  return Array.from(new Set([raw, hyphen, underscore]));
}

export function resolveLocalizedField(item: LocalizedLike | null | undefined, field: string, locale: string): ResolvedFieldMeta {
  if (!item) return { value: '', source: 'empty' };

  const localeDisplay = asText(item.locale?.display?.[field]);
  if (localeDisplay) return { value: localeDisplay, source: 'locale.display' };

  const topDisplay = asText(item.display?.[field]);
  if (topDisplay) return { value: topDisplay, source: 'display' };

  const fullVariants = localeVariants(locale);
  const primary = primaryLocale(locale);

  for (const variant of fullVariants) {
    const exact = asText(item[`${field}_${variant}`]);
    if (exact) return { value: exact, source: 'legacy_exact' };
  }

  const primaryValue = asText(item[`${field}_${primary}`]);
  if (primaryValue) return { value: primaryValue, source: 'legacy_primary' };

  const baseValue = asText(item[field]);
  if (baseValue) return { value: baseValue, source: 'base' };

  const enValue = asText(item[`${field}_en`]);
  if (enValue) return { value: enValue, source: 'legacy_en' };

  const arValue = asText(item[`${field}_ar`]);
  if (arValue) return { value: arValue, source: 'legacy_ar' };

  return { value: '', source: 'empty' };
}

export function hasLegacyLocaleValue(item: LocalizedLike | null | undefined, field: string, locale: string): boolean {
  const source = resolveLocalizedField(item, field, locale).source;
  return isLegacySource(source);
}
