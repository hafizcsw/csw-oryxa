import { describe, expect, it } from 'vitest';
import { resolveLocalizedField } from '@/lib/localization/displayAdapter';

describe('resolveLocalizedField', () => {
  it('prefers locale.display over legacy and base fields', () => {
    const item = {
      locale: { display: { program_name: 'هندسة البرمجيات' } },
      program_name_ar: 'اسم عربي قديم',
      program_name: 'Software Engineering',
    };

    const result = resolveLocalizedField(item, 'program_name', 'ar');
    expect(result).toEqual({ value: 'هندسة البرمجيات', source: 'locale.display' });
  });

  it('prefers locale legacy suffix over base fallback for Arabic locale', () => {
    const item = {
      program_name: 'Software Engineering',
      program_name_en: 'Software Engineering',
      program_name_ar: 'هندسة البرمجيات',
    };

    const result = resolveLocalizedField(item, 'program_name', 'ar');
    expect(result).toEqual({ value: 'هندسة البرمجيات', source: 'legacy_primary' });
  });

  it('supports underscore locale variants for compatibility locale codes', () => {
    const item = {
      university_name_ar: 'جامعة القاهرة',
      university_name: 'Cairo University',
    };

    const result = resolveLocalizedField(item, 'university_name', 'ar_EG');
    expect(result).toEqual({ value: 'جامعة القاهرة', source: 'legacy_primary' });
  });

  it('prefers compatibility en suffix over base for non-ar locales when display fields are absent', () => {
    const item = {
      country_name: 'المانيا',
      country_name_en: 'Germany',
      country_name_ar: 'ألمانيا',
    };

    const result = resolveLocalizedField(item, 'country_name', 'fr');
    expect(result).toEqual({ value: 'Germany', source: 'legacy_en' });
  });

  it('supports hyphen locale variants by using primary compatibility fallback', () => {
    const item = {
      university_name_ar: 'جامعة القاهرة',
      university_name: 'Cairo University',
    };

    const result = resolveLocalizedField(item, 'university_name', 'ar-EG');
    expect(result).toEqual({ value: 'جامعة القاهرة', source: 'legacy_primary' });
  });

  it('resolves exact legacy locale key across underscore/hyphen variants before primary fallback', () => {
    const item = {
      university_name_ar_eg: 'جامعة القاهرة - مصر',
      university_name_ar: 'جامعة القاهرة',
      university_name: 'Cairo University',
    };

    const result = resolveLocalizedField(item, 'university_name', 'ar-EG');
    expect(result).toEqual({ value: 'جامعة القاهرة - مصر', source: 'legacy_exact' });
  });

});
