/**
 * Dynamic geodata loader for amCharts 5 country subdivisions.
 * Maps ISO A2 codes to lazy-loaded amCharts geodata modules.
 * Only the selected country's geodata is loaded (code-split by Vite).
 */

type GeoDataLoader = () => Promise<{ default: GeoJSON.FeatureCollection }>;

const GEODATA_MAP: Record<string, GeoDataLoader> = {
  AF: () => import("@amcharts/amcharts5-geodata/afghanistanLow"),
  AL: () => import("@amcharts/amcharts5-geodata/albaniaLow"),
  DZ: () => import("@amcharts/amcharts5-geodata/algeriaLow"),
  AO: () => import("@amcharts/amcharts5-geodata/angolaLow"),
  AR: () => import("@amcharts/amcharts5-geodata/argentinaLow"),
  AM: () => import("@amcharts/amcharts5-geodata/armeniaLow"),
  AU: () => import("@amcharts/amcharts5-geodata/australiaLow"),
  AT: () => import("@amcharts/amcharts5-geodata/austriaLow"),
  AZ: () => import("@amcharts/amcharts5-geodata/azerbaijanLow"),
  BH: () => import("@amcharts/amcharts5-geodata/bahrainLow"),
  BD: () => import("@amcharts/amcharts5-geodata/bangladeshLow"),
  BY: () => import("@amcharts/amcharts5-geodata/belarusLow"),
  BE: () => import("@amcharts/amcharts5-geodata/belgiumLow"),
  BA: () => import("@amcharts/amcharts5-geodata/bosniaHerzegovinaLow"),
  BW: () => import("@amcharts/amcharts5-geodata/botswanaLow"),
  BR: () => import("@amcharts/amcharts5-geodata/brazilLow"),
  BG: () => import("@amcharts/amcharts5-geodata/bulgariaLow"),
  KH: () => import("@amcharts/amcharts5-geodata/cambodiaLow"),
  CM: () => import("@amcharts/amcharts5-geodata/cameroonLow"),
  CA: () => import("@amcharts/amcharts5-geodata/canadaLow"),
  CL: () => import("@amcharts/amcharts5-geodata/chileLow"),
  CN: () => import("@amcharts/amcharts5-geodata/chinaLow"),
  CO: () => import("@amcharts/amcharts5-geodata/colombiaLow"),
  HR: () => import("@amcharts/amcharts5-geodata/croatiaLow"),
  CU: () => import("@amcharts/amcharts5-geodata/cubaLow"),
  CY: () => import("@amcharts/amcharts5-geodata/cyprusLow"),
  CZ: () => import("@amcharts/amcharts5-geodata/czechiaLow"),
  DK: () => import("@amcharts/amcharts5-geodata/denmarkLow"),
  DO: () => import("@amcharts/amcharts5-geodata/dominicanRepublicLow"),
  EC: () => import("@amcharts/amcharts5-geodata/ecuadorLow"),
  EG: () => import("@amcharts/amcharts5-geodata/egyptLow"),
  EE: () => import("@amcharts/amcharts5-geodata/estoniaLow"),
  ET: () => import("@amcharts/amcharts5-geodata/ethiopiaLow"),
  FI: () => import("@amcharts/amcharts5-geodata/finlandLow"),
  FR: () => import("@amcharts/amcharts5-geodata/franceLow"),
  GE: () => import("@amcharts/amcharts5-geodata/georgiaLow"),
  DE: () => import("@amcharts/amcharts5-geodata/germanyLow"),
  GH: () => import("@amcharts/amcharts5-geodata/ghanaLow"),
  GR: () => import("@amcharts/amcharts5-geodata/greeceLow"),
  GT: () => import("@amcharts/amcharts5-geodata/guatemalaLow"),
  HN: () => import("@amcharts/amcharts5-geodata/hondurasLow"),
  HU: () => import("@amcharts/amcharts5-geodata/hungaryLow"),
  IS: () => import("@amcharts/amcharts5-geodata/icelandLow"),
  IN: () => import("@amcharts/amcharts5-geodata/indiaLow"),
  ID: () => import("@amcharts/amcharts5-geodata/indonesiaLow"),
  IR: () => import("@amcharts/amcharts5-geodata/iranLow"),
  IQ: () => import("@amcharts/amcharts5-geodata/iraqLow"),
  IE: () => import("@amcharts/amcharts5-geodata/irelandLow"),
  IL: () => import("@amcharts/amcharts5-geodata/israelLow"), // displayed as Palestine
  IT: () => import("@amcharts/amcharts5-geodata/italyLow"),
  JM: () => import("@amcharts/amcharts5-geodata/jamaicaLow"),
  JP: () => import("@amcharts/amcharts5-geodata/japanLow"),
  JO: () => import("@amcharts/amcharts5-geodata/jordanLow"),
  KZ: () => import("@amcharts/amcharts5-geodata/kazakhstanLow"),
  KE: () => import("@amcharts/amcharts5-geodata/kenyaLow"),
  KR: () => import("@amcharts/amcharts5-geodata/southKoreaLow"),
  KW: () => import("@amcharts/amcharts5-geodata/kuwaitLow"),
  KG: () => import("@amcharts/amcharts5-geodata/kyrgyzstanLow"),
  LV: () => import("@amcharts/amcharts5-geodata/latviaLow"),
  LB: () => import("@amcharts/amcharts5-geodata/lebanonLow"),
  LY: () => import("@amcharts/amcharts5-geodata/libyaLow"),
  LT: () => import("@amcharts/amcharts5-geodata/lithuaniaLow"),
  LU: () => import("@amcharts/amcharts5-geodata/luxembourgLow"),
  MY: () => import("@amcharts/amcharts5-geodata/malaysiaLow"),
  ML: () => import("@amcharts/amcharts5-geodata/maliLow"),
  MT: () => import("@amcharts/amcharts5-geodata/maltaLow"),
  MX: () => import("@amcharts/amcharts5-geodata/mexicoLow"),
  MD: () => import("@amcharts/amcharts5-geodata/moldovaLow"),
  MN: () => import("@amcharts/amcharts5-geodata/mongoliaLow"),
  ME: () => import("@amcharts/amcharts5-geodata/montenegroLow"),
  MA: () => import("@amcharts/amcharts5-geodata/moroccoLow"),
  MZ: () => import("@amcharts/amcharts5-geodata/mozambiqueLow"),
  MM: () => import("@amcharts/amcharts5-geodata/myanmarLow"),
  NA: () => import("@amcharts/amcharts5-geodata/namibiaLow"),
  NP: () => import("@amcharts/amcharts5-geodata/nepalLow"),
  NL: () => import("@amcharts/amcharts5-geodata/netherlandsLow"),
  NZ: () => import("@amcharts/amcharts5-geodata/newZealandLow"),
  NG: () => import("@amcharts/amcharts5-geodata/nigeriaLow"),
  NO: () => import("@amcharts/amcharts5-geodata/norwayLow"),
  OM: () => import("@amcharts/amcharts5-geodata/omanLow"),
  PK: () => import("@amcharts/amcharts5-geodata/pakistanLow"),
  PA: () => import("@amcharts/amcharts5-geodata/panamaLow"),
  PY: () => import("@amcharts/amcharts5-geodata/paraguayLow"),
  PE: () => import("@amcharts/amcharts5-geodata/peruLow"),
  PH: () => import("@amcharts/amcharts5-geodata/philippinesLow"),
  PL: () => import("@amcharts/amcharts5-geodata/polandLow"),
  PT: () => import("@amcharts/amcharts5-geodata/portugalLow"),
  QA: () => import("@amcharts/amcharts5-geodata/qatarLow"),
  RO: () => import("@amcharts/amcharts5-geodata/romaniaLow"),
  RU: () => import("@amcharts/amcharts5-geodata/russiaLow"),
  RW: () => import("@amcharts/amcharts5-geodata/rwandaLow"),
  SA: () => import("@amcharts/amcharts5-geodata/saudiArabiaLow"),
  SN: () => import("@amcharts/amcharts5-geodata/senegalLow"),
  RS: () => import("@amcharts/amcharts5-geodata/serbiaLow"),
  SG: () => import("@amcharts/amcharts5-geodata/singaporeLow"),
  SK: () => import("@amcharts/amcharts5-geodata/slovakiaLow"),
  SI: () => import("@amcharts/amcharts5-geodata/sloveniaLow"),
  ZA: () => import("@amcharts/amcharts5-geodata/southAfricaLow"),
  ES: () => import("@amcharts/amcharts5-geodata/spainLow"),
  LK: () => import("@amcharts/amcharts5-geodata/sriLankaLow"),
  SD: () => import("@amcharts/amcharts5-geodata/sudanLow"),
  SE: () => import("@amcharts/amcharts5-geodata/swedenLow"),
  CH: () => import("@amcharts/amcharts5-geodata/switzerlandLow"),
  SY: () => import("@amcharts/amcharts5-geodata/syriaLow"),
  TW: () => import("@amcharts/amcharts5-geodata/taiwanLow"),
  TJ: () => import("@amcharts/amcharts5-geodata/tajikistanLow"),
  TZ: () => import("@amcharts/amcharts5-geodata/tanzaniaLow"),
  TH: () => import("@amcharts/amcharts5-geodata/thailandLow"),
  TN: () => import("@amcharts/amcharts5-geodata/tunisiaLow"),
  TR: () => import("@amcharts/amcharts5-geodata/turkeyLow"),
  TM: () => import("@amcharts/amcharts5-geodata/turkmenistanLow"),
  UG: () => import("@amcharts/amcharts5-geodata/ugandaLow"),
  UA: () => import("@amcharts/amcharts5-geodata/ukraineLow"),
  AE: () => import("@amcharts/amcharts5-geodata/uaeLow"),
  GB: () => import("@amcharts/amcharts5-geodata/ukLow"),
  US: () => import("@amcharts/amcharts5-geodata/usaLow"),
  UY: () => import("@amcharts/amcharts5-geodata/uruguayLow"),
  UZ: () => import("@amcharts/amcharts5-geodata/uzbekistanLow"),
  VE: () => import("@amcharts/amcharts5-geodata/venezuelaLow"),
  VN: () => import("@amcharts/amcharts5-geodata/vietnamLow"),
  YE: () => import("@amcharts/amcharts5-geodata/yemenLow"),
  ZM: () => import("@amcharts/amcharts5-geodata/zambiaLow"),
  ZW: () => import("@amcharts/amcharts5-geodata/zimbabweLow"),
  PS: () => import("@amcharts/amcharts5-geodata/palestineLow"),
  CD: () => import("@amcharts/amcharts5-geodata/congoDRLow"),
  CI: () => import("@amcharts/amcharts5-geodata/cotedIvoireLow"),
  BO: () => import("@amcharts/amcharts5-geodata/boliviaLow"),
};

// Cache loaded geodata
const cache = new Map<string, GeoJSON.FeatureCollection>();

function normalizeGeodataCountryCode(countryCode: string): string {
  const requestedCode = countryCode.toUpperCase();
  return requestedCode === "PS" ? "IL" : requestedCode;
}

export function getCachedCountryGeodata(
  countryCode: string
): GeoJSON.FeatureCollection | null {
  const code = normalizeGeodataCountryCode(countryCode);
  return cache.get(code) ?? null;
}

/**
 * Load subdivision geodata for a country (cached, code-split).
 * Returns null if country not supported.
 */
export async function loadCountryGeodata(
  countryCode: string
): Promise<GeoJSON.FeatureCollection | null> {
  const requestedCode = countryCode.toUpperCase();
  const code = normalizeGeodataCountryCode(countryCode);
  if (cache.has(code)) return cache.get(code)!;

  const loader = GEODATA_MAP[code];
  if (!loader) return null;

  try {
    const mod = await loader();
    const data = mod.default;
    cache.set(code, data);
    return data;
  } catch (e) {
    console.warn(`[geodata] Failed to load subdivisions for ${requestedCode}`, e);
    return null;
  }
}

/** Check if subdivision geodata is available for a country */
export function hasCountryGeodata(countryCode: string): boolean {
  return !!GEODATA_MAP[normalizeGeodataCountryCode(countryCode)];
}
