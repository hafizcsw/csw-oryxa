import i18n from '@/i18n';

export const humanizeLanguageCourseValue = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const translateLanguageCourseValue = (t: (key: string, options?: any) => string, key: string, value: string) =>
  t(key, { defaultValue: humanizeLanguageCourseValue(value) });

export function parseLanguageCourseVocabularyEntry(key: string) {
  const source = String(i18n.t(key, { lng: 'en', defaultValue: '' }) || '').trim();
  if (!source) return null;
  const separator = [' — ', ' – ', ' - ', ': '].find((candidate) => source.includes(candidate));
  if (!separator) {
    return { term: source, meaning: null as string | null };
  }
  const [term, ...rest] = source.split(separator);
  return {
    term: term.trim(),
    meaning: rest.join(separator).trim() || null,
  };
}
