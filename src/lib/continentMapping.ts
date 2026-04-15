/**
 * Country code → Continent mapping for hierarchical shortlist display
 */

export const CONTINENT_MAP: Record<string, string> = {
  // Asia
  CN: 'asia', JP: 'asia', KR: 'asia', IN: 'asia', MY: 'asia',
  SG: 'asia', TH: 'asia', ID: 'asia', PH: 'asia', VN: 'asia', PK: 'asia',
  BD: 'asia', LK: 'asia', KZ: 'asia', UZ: 'asia', TJ: 'asia', KG: 'asia',
  TM: 'asia', AZ: 'asia', GE: 'asia', AM: 'asia', TR: 'asia', SA: 'asia',
  AE: 'asia', QA: 'asia', KW: 'asia', BH: 'asia', OM: 'asia', JO: 'asia',
  LB: 'asia', IQ: 'asia', SY: 'asia', YE: 'asia', IL: 'asia', PS: 'asia',
  IR: 'asia', AF: 'asia', NP: 'asia', MM: 'asia', LA: 'asia', KH: 'asia',
  MN: 'asia', TW: 'asia', HK: 'asia', MO: 'asia', BN: 'asia', TL: 'asia',
  MV: 'asia', BT: 'asia',
  // Europe
  RU: 'europe', GB: 'europe', DE: 'europe', FR: 'europe', IT: 'europe', ES: 'europe',
  NL: 'europe', BE: 'europe', PT: 'europe', AT: 'europe', CH: 'europe',
  SE: 'europe', NO: 'europe', DK: 'europe', FI: 'europe', IE: 'europe',
  PL: 'europe', CZ: 'europe', HU: 'europe', RO: 'europe', BG: 'europe',
  HR: 'europe', SK: 'europe', SI: 'europe', LT: 'europe', LV: 'europe',
  EE: 'europe', CY: 'europe', MT: 'europe', LU: 'europe', GR: 'europe',
  RS: 'europe', BA: 'europe', ME: 'europe', MK: 'europe', AL: 'europe',
  XK: 'europe', MD: 'europe', UA: 'europe', BY: 'europe', IS: 'europe',
  // North America
  US: 'north_america', CA: 'north_america', MX: 'north_america',
  // South America
  BR: 'south_america', AR: 'south_america', CL: 'south_america',
  CO: 'south_america', PE: 'south_america', VE: 'south_america',
  EC: 'south_america', BO: 'south_america', PY: 'south_america',
  UY: 'south_america',
  // Africa
  EG: 'africa', MA: 'africa', TN: 'africa', DZ: 'africa', LY: 'africa',
  SD: 'africa', NG: 'africa', ZA: 'africa', KE: 'africa', GH: 'africa',
  ET: 'africa', TZ: 'africa', UG: 'africa', SN: 'africa', CM: 'africa',
  CI: 'africa', MR: 'africa', SO: 'africa', DJ: 'africa',
  // Oceania
  AU: 'oceania', NZ: 'oceania',
};

export const CONTINENT_NAMES: Record<string, { ar: string; en: string }> = {
  asia: { ar: 'آسيا', en: 'Asia' },
  europe: { ar: 'أوروبا', en: 'Europe' },
  north_america: { ar: 'أمريكا الشمالية', en: 'North America' },
  south_america: { ar: 'أمريكا الجنوبية', en: 'South America' },
  africa: { ar: 'أفريقيا', en: 'Africa' },
  oceania: { ar: 'أوقيانوسيا', en: 'Oceania' },
  other: { ar: 'أخرى', en: 'Other' },
};

export function getContinent(countryCode?: string | null): string {
  if (!countryCode) return 'other';
  return CONTINENT_MAP[countryCode.toUpperCase()] || 'other';
}

export function getContinentName(continentKey: string, lang: string = 'ar'): string {
  const names = CONTINENT_NAMES[continentKey] || CONTINENT_NAMES.other;
  return lang === 'ar' ? names.ar : names.en;
}
