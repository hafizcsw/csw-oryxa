/**
 * Leaflet-based World Map — vanilla Leaflet (no react-leaflet).
 * Clean map with GeoJSON country boundaries that highlight based on data/filters.
 * Drill-down: World (country borders) → Country (city dots) → Region (university pins).
 */
import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";
import * as topojson from "topojson-client";
import { useLanguage } from "@/contexts/LanguageContext";
import type { RegionSummary } from "@/lib/regionMapping";
import { getLocalizedCountryName } from "@/lib/countryDisplayName";
import type { CitySummary, CityUniversity } from "@/hooks/useMapData";
import type { OsmOverlayMatch } from "@/hooks/useOsmCityOverlay";
import {
  resolveUniversityLocation,
  resolveCityLocation,
  buildCityCoordsMap,
  isCityFallback,
  type ResolvedLocation,
} from "@/lib/geoResolver";
import {
  detectWorldGeoFetchSource,
  getCachedWorldGeo,
  setCachedWorldGeo,
} from "@/lib/worldGeoCache";

/* ── Fix default marker icons ── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ── Country center coordinates ── */
const CC: Record<string, [number, number]> = {
  AF:[33,65],AL:[41,20],DZ:[28,3],AO:[-12.5,18.5],AR:[-34,-64],AM:[40,45],AU:[-25,134],AT:[47.5,14],AZ:[40.5,47.5],
  BH:[26,50.5],BD:[24,90],BY:[53.5,28],BE:[50.8,4.3],BA:[44,17.8],BW:[-22.3,24],BR:[-10,-55],BG:[43,25],KH:[12.5,105],
  CM:[6,12.5],CA:[56,-96],CL:[-33.5,-71],CN:[35,105],CO:[4,-72],HR:[45.2,15.5],CU:[22,-79.5],CY:[35,33],CZ:[49.7,15.5],
  DK:[56,10],DO:[19,-70.7],EC:[-1.5,-78.5],EG:[27,30],EE:[59,25.5],ET:[8,38],FI:[64,26],FR:[46.5,2.5],GE:[42,43.5],
  DE:[51,10],GH:[7.9,-1.2],GR:[39,22],GT:[15.5,-90.3],HN:[14.7,-86.3],HU:[47,19],IS:[65,-18],IN:[22,78.5],ID:[-2.5,118],
  IR:[32.5,53.5],IQ:[33.2,43.7],IE:[53.4,-8],IL:[31.5,34.8],IT:[42.5,12.5],JM:[18.1,-77.3],JP:[36,138],JO:[31.2,36.5],
  KZ:[48,67.5],KE:[0.5,38],KR:[36,128],KW:[29.3,47.5],KG:[41,75],LV:[57,25],LB:[33.8,35.8],LY:[27,17],LT:[55.5,24],
  LU:[49.8,6.1],MY:[4.2,101.8],ML:[17.5,-4],MT:[35.9,14.4],MX:[23,-102],MD:[47,29],MN:[47.5,105],ME:[42.5,19.3],
  MA:[32,-6],MZ:[-18.7,35.5],MM:[21,96],NA:[-22,17],NP:[28,84],NL:[52.3,5.7],NZ:[-41,174],NG:[9.1,8.7],NO:[62,10],
  OM:[21,57],PK:[30,69],PA:[9,-80],PY:[-23,-58],PE:[-10,-76],PH:[12.8,122],PL:[52,20],PT:[39.5,-8],QA:[25.5,51.2],
  RO:[46,25],RU:[62,96],RW:[-2,29.5],SA:[24,44.5],SN:[14.5,-14.5],RS:[44,21],SG:[1.35,103.8],SK:[48.7,19.5],
  SI:[46.1,14.8],ZA:[-29,25],ES:[40,-4],LK:[7.5,80.5],SD:[15.5,30],SE:[62,15],CH:[47,8.2],SY:[35,38.5],
  TW:[23.5,121],TJ:[38.5,71],TZ:[-6.5,35],TH:[15,100],TN:[34,9.5],TR:[39,35],TM:[39,59.5],UG:[1.5,32.5],
  UA:[49,32],AE:[24,54],GB:[54,-2],US:[39.5,-98.5],UY:[-33,-56],UZ:[41.5,64.5],VE:[8,-66],VN:[16,106],
  YE:[15.5,48],ZM:[-13,28.5],ZW:[-19.8,29.9],PS:[31.9,35.2],CD:[-2.5,23.6],CI:[7.5,-5.5],BO:[-17,-65],
  MR:[20.2,-10.4],LA:[18.2,103.8],
};

/* ── Tile URLs ── */
const TILES = {
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  referenceLabels: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  labels: "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
  streetsLight: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  streetsDark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  topo: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
};

/* ── World GeoJSON URL ── */
const WORLD_GEOJSON_URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";
const USE_TOPOJSON = false;

const GOLD = {
  fillLight: "rgba(240,185,11,0.45)",
  fillLightHover: "rgba(240,185,11,0.62)",
  fillDark: "rgba(240,185,11,0.58)",
  fillDarkHover: "rgba(252,211,77,0.78)",
  strokeLight: "rgba(240,185,11,1)",
  strokeLightHover: "rgba(240,185,11,1)",
  strokeDark: "rgba(253,224,71,1)",
  strokeDarkHover: "rgba(254,240,138,1)",
  mutedStrokeLight: "rgba(218,165,32,0.35)",
  mutedStrokeDark: "rgba(252,211,77,0.34)",
};

/* ── Subtle white/gray borders for default state (Google Maps style) ── */
const BORDER = {
  defaultLight: "rgba(180,180,180,0.5)",
  defaultDark: "rgba(200,200,200,0.3)",
  noDataLight: "rgba(160,160,160,0.25)",
  noDataDark: "rgba(150,150,150,0.15)",
  filteredLight: "rgba(148,163,184,0.12)",
  filteredDark: "rgba(71,85,105,0.1)",
};

const TILE_FILTERS = {
  satellite: {
    light: "saturate(1) contrast(1) brightness(1.02)",
    dark: "saturate(0.9) contrast(1) brightness(0.5)",
  },
  labels: {
    light: "invert(1) brightness(2) contrast(0.85) opacity(0.92)",
    dark: "invert(1) brightness(2.5) contrast(0.7) opacity(1)",
  },
  topo: {
    light: "saturate(1.04) contrast(1.02) brightness(1.02)",
    dark: "saturate(1.05) contrast(1.2) brightness(0.65)",
  },
};

/* ── ISO_A3 → ISO_A2 fallback map for GeoJSON files with bad ISO_A2 ── */
const ISO3_TO_ISO2: Record<string, string> = {
  AFG:"AF",ALB:"AL",DZA:"DZ",AGO:"AO",ARG:"AR",ARM:"AM",AUS:"AU",AUT:"AT",AZE:"AZ",
  BHR:"BH",BGD:"BD",BLR:"BY",BEL:"BE",BIH:"BA",BWA:"BW",BRA:"BR",BGR:"BG",KHM:"KH",
  CMR:"CM",CAN:"CA",CHL:"CL",CHN:"CN",COL:"CO",HRV:"HR",CUB:"CU",CYP:"CY",CZE:"CZ",
  DNK:"DK",DOM:"DO",ECU:"EC",EGY:"EG",EST:"EE",ETH:"ET",FIN:"FI",FRA:"FR",GEO:"GE",
  DEU:"DE",GHA:"GH",GRC:"GR",GTM:"GT",HND:"HN",HUN:"HU",ISL:"IS",IND:"IN",IDN:"ID",
  IRN:"IR",IRQ:"IQ",IRL:"IE",ISR:"IL",ITA:"IT",JAM:"JM",JPN:"JP",JOR:"JO",KAZ:"KZ",
  KEN:"KE",KOR:"KR",KWT:"KW",KGZ:"KG",LVA:"LV",LBN:"LB",LBY:"LY",LTU:"LT",LUX:"LU",
  MYS:"MY",MLI:"ML",MLT:"MT",MEX:"MX",MDA:"MD",MNG:"MN",MNE:"ME",MAR:"MA",MOZ:"MZ",
  MMR:"MM",NAM:"NA",NPL:"NP",NLD:"NL",NZL:"NZ",NGA:"NG",NOR:"NO",OMN:"OM",PAK:"PK",
  PAN:"PA",PRY:"PY",PER:"PE",PHL:"PH",POL:"PL",PRT:"PT",QAT:"QA",ROU:"RO",RUS:"RU",
  RWA:"RW",SAU:"SA",SEN:"SN",SRB:"RS",SGP:"SG",SVK:"SK",SVN:"SI",ZAF:"ZA",ESP:"ES",
  LKA:"LK",SDN:"SD",SWE:"SE",CHE:"CH",SYR:"SY",TWN:"TW",TJK:"TJ",TZA:"TZ",THA:"TH",
  TUN:"TN",TUR:"TR",TKM:"TM",UGA:"UG",UKR:"UA",ARE:"AE",GBR:"GB",USA:"US",URY:"UY",
  UZB:"UZ",VEN:"VE",VNM:"VN",YEM:"YE",ZMB:"ZM",ZWE:"ZW",PSE:"PS",COD:"CD",CIV:"CI",
  BOL:"BO",MRT:"MR",LAO:"LA",SSD:"SS",SOM:"SO",
};
export interface LeafletMapHandle {
  flyTo: (lat: number, lon: number, zoom?: number) => void;
}

export interface MapViewport {
  zoom: number;
  bounds: L.LatLngBounds;
  activeCountryCode: string | null;
}

export interface LeafletMapProps {
  countryStats: Record<string, {
    country_name_ar: string;
    country_name_en: string;
    universities_count: number;
    programs_count: number;
    fee_min: number | null;
    fee_max: number | null;
  }> | undefined;
  onCountrySelect: (code: string | null) => void;
  onRegionSelect: (regionId: string) => void;
  onCitySelect?: (cityName: string) => void;
  onBackToCountry?: () => void;
  onBackToWorld?: () => void;
  onViewportChange?: (viewport: MapViewport) => void;
  selectedCountryCode: string | null;
  selectedRegionId: string | null;
  drillLevel: "world" | "country" | "region";
  isRtl: boolean;
  subdivisionGeodata: GeoJSON.FeatureCollection | null;
  regionSummaries: RegionSummary[];
  visibleCountryCodes: Set<string> | null;
  citySummaries?: CitySummary[];
  cityUniversities?: CityUniversity[];
  regionCities?: string[];
  osmOverlay?: Map<string, OsmOverlayMatch>;
  osmOverlayLoading?: boolean;
  countryMeta?: Record<string, { slug: string; name_ar: string; name_en: string | null; image_url: string | null }>;
  onCountryHover?: (code: string | null) => void;
}

/* ── City dot icon with country flag + university count badge ── */
function cityDotIcon(count: number, isDark: boolean, countryCode?: string): L.DivIcon {
  const size = Math.min(46, Math.max(30, 22 + count * 2));
  const cc = countryCode?.toLowerCase();
  const flagUrl = cc ? `https://flagcdn.com/w80/${cc}.png` : null;
  const fallbackBg = isDark
    ? "linear-gradient(135deg, rgba(52,211,153,0.95), rgba(16,185,129,0.9))"
    : "linear-gradient(135deg, rgba(5,150,105,0.95), rgba(4,120,87,0.9))";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      ${flagUrl ? `background:url('${flagUrl}') center/cover no-repeat` : `background:${fallbackBg}`};
      border:2.5px solid ${isDark ? 'rgba(167,243,208,0.7)' : 'rgba(255,255,255,0.9)'};
      box-shadow:0 0 14px ${isDark ? 'rgba(52,211,153,0.5)' : 'rgba(5,150,105,0.4)'}, 0 2px 8px rgba(0,0,0,0.3);
      cursor:pointer;transition:all 0.2s ease;
      display:flex;align-items:center;justify-content:center;
      position:relative;overflow:hidden;
    " onmouseenter="this.style.transform='scale(1.25)'" onmouseleave="this.style.transform='scale(1)'">
      <span style="
        position:relative;z-index:1;
        font-size:${size > 34 ? 14 : 12}px;font-weight:800;color:white;
        font-family:system-ui;letter-spacing:-0.5px;
        text-shadow:0 1px 3px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.5);
      ">${count}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* ── University marker with logo ── */
function uniMarkerIcon(logo: string | null, isDark: boolean): L.DivIcon {
  const size = 44;
  const border = isDark ? "rgba(147,197,253,0.6)" : "rgba(59,130,246,0.5)";
  const innerHtml = logo
    ? `<img src="${logo}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:18px;border-radius:10px;background:${isDark ? 'rgba(30,41,59,0.95)' : 'rgba(248,250,252,0.95)'}">🏛️</div>`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;border-radius:10px;background:${isDark ? 'rgba(30,41,59,0.95)' : 'rgba(248,250,252,0.95)'}">🏛️</div>`;

  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:12px;
      background:${isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)'};
      border:2.5px solid ${border};
      box-shadow:0 0 14px rgba(59,130,246,0.3), 0 3px 12px rgba(0,0,0,0.3);
      cursor:pointer;transition:all 0.2s ease;
      overflow:hidden;padding:3px;
    " onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'">
      ${innerHtml}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* ── Dorm/Housing marker icon ── */
function dormMarkerIcon(isDark: boolean): L.DivIcon {
  const size = 32;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:10px;
      background:${isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.98)'};
      border:2px solid ${isDark ? 'rgba(251,191,36,0.7)' : 'rgba(217,119,6,0.6)'};
      box-shadow:0 0 10px rgba(251,191,36,0.3), 0 2px 8px rgba(0,0,0,0.2);
      cursor:pointer;transition:all 0.2s ease;
      display:flex;align-items:center;justify-content:center;font-size:16px;
    " onmouseenter="this.style.transform='scale(1.15)'" onmouseleave="this.style.transform='scale(1)'">
      🏠
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* ── World GeoJSON hot cache + diagnostics ── */
let geoJsonCache: GeoJSON.FeatureCollection | null = null;

function logWorldGeoEvent(
  level: "info" | "error",
  message: string,
  details: Record<string, unknown>
) {
  const logger = level === "error" ? console.error : console.info;
  logger(message, details);
}

/** Resolve ISO A2 code from feature properties (handles multiple GeoJSON schemas) */
function getCountryCode(feature: GeoJSON.Feature): string | null {
  const p = feature.properties;
  if (!p) return null;

  const a2 = p.ISO_A2 || p.iso_a2 || p["ISO3166-1-Alpha-2"];
  if (a2 && a2 !== "-99" && a2 !== "-1" && a2.length === 2) {
    const upper = a2.toUpperCase();
    if (upper === "IL" || upper === "PS") return "PS";
    return upper;
  }

  const a3 = p.ISO_A3 || p.iso_a3 || p["ISO3166-1-Alpha-3"];
  if (a3 && a3 !== "-99" && a3 !== "-1") {
    const upper = a3.toUpperCase();
    if (upper === "ISR" || upper === "PSE") return "PS";
    if (ISO3_TO_ISO2[upper]) return ISO3_TO_ISO2[upper];
  }

  const adm = p.ADM0_A3 || p.adm0_a3;
  if (adm && adm !== "-99" && adm !== "-1") {
    const upper = adm.toUpperCase();
    if (upper === "ISR" || upper === "PSE" || upper === "PSX") return "PS";
    if (ISO3_TO_ISO2[upper]) return ISO3_TO_ISO2[upper];
  }

  // Name-based fallback for countries with all -99 codes (e.g. Norway in Natural Earth)
  const featureName = (p.NAME || p.name || p.ADMIN || "").trim().toLowerCase();
  const NAME_TO_CODE: Record<string, string> = {
    norway: "NO", "northern cyprus": "CY", somaliland: "SO",
    kosovo: "XK", "western sahara": "EH",
  };
  if (NAME_TO_CODE[featureName]) return NAME_TO_CODE[featureName];

  return null;
}

function normalizeLngAroundReference(lng: number, reference: number): number {
  let adjusted = lng;
  while (adjusted - reference > 180) adjusted -= 360;
  while (adjusted - reference < -180) adjusted += 360;
  return adjusted;
}

function isPointInsideRing(lat: number, lng: number, ring: GeoJSON.Position[]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lngI, latI] = ring[i] as [number, number];
    const [lngJ, latJ] = ring[j] as [number, number];
    const adjustedLngI = normalizeLngAroundReference(lngI, lng);
    const adjustedLngJ = normalizeLngAroundReference(lngJ, lng);
    const latDelta = latJ - latI;

    const intersects =
      (latI > lat) !== (latJ > lat) &&
      lng < (((adjustedLngJ - adjustedLngI) * (lat - latI)) / (latDelta || Number.EPSILON)) + adjustedLngI;

    if (intersects) inside = !inside;
  }

  return inside;
}

function isPointInsidePolygon(lat: number, lng: number, polygon: GeoJSON.Position[][]): boolean {
  if (polygon.length === 0) return false;
  if (!isPointInsideRing(lat, lng, polygon[0])) return false;

  for (let i = 1; i < polygon.length; i += 1) {
    if (isPointInsideRing(lat, lng, polygon[i])) return false;
  }

  return true;
}

function featureContainsLatLng(feature: GeoJSON.Feature, latlng: L.LatLng): boolean {
  const geometry = feature.geometry;
  if (!geometry) return false;

  if (geometry.type === "Polygon") {
    return isPointInsidePolygon(latlng.lat, latlng.lng, geometry.coordinates as GeoJSON.Position[][]);
  }

  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as GeoJSON.Position[][][]).some((polygon) =>
      isPointInsidePolygon(latlng.lat, latlng.lng, polygon)
    );
  }

  return false;
}

function resolveViewportCountryCode(
  latlng: L.LatLng,
  worldGeo: GeoJSON.FeatureCollection | null,
  countryStats: Record<string, { universities_count: number }> | undefined,
): string | null {
  if (!worldGeo || !countryStats) return null;

  for (const feature of worldGeo.features) {
    const code = getCountryCode(feature);
    if (!code) continue;

    const stats = countryStats[code];
    if (!stats || stats.universities_count === 0) continue;

    if (featureContainsLatLng(feature, latlng)) {
      return code;
    }
  }

  return null;
}

async function loadWorldGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  if (geoJsonCache && Array.isArray(geoJsonCache.features) && geoJsonCache.features.length > 0) {
    logWorldGeoEvent("info", "[Map] World GeoJSON ready", {
      source: "memory",
      featureCount: geoJsonCache.features.length,
    });
    return geoJsonCache;
  }

  const cached = await getCachedWorldGeo();
  if (cached.data) {
    geoJsonCache = cached.data;
    logWorldGeoEvent("info", "[Map] World GeoJSON ready", {
      source: cached.source,
      featureCount: geoJsonCache.features.length,
    });
    return geoJsonCache;
  }

  const fetchSource = await detectWorldGeoFetchSource(WORLD_GEOJSON_URL);
  const res = await fetch(WORLD_GEOJSON_URL);
  if (!res.ok) {
    const reason = `[Map] Failed to fetch geodata (${res.status})`;
    logWorldGeoEvent("error", "[Map] World GeoJSON load failed", {
      source: fetchSource,
      featureCount: 0,
      reason,
      status: res.status,
    });
    throw new Error(reason);
  }

  const data = await res.json();

  if (USE_TOPOJSON && data?.type === "Topology") {
    const objects = data?.objects && typeof data.objects === "object" ? data.objects as Record<string, unknown> : null;
    const objectNames = objects ? Object.keys(objects) : [];
    const objectName = objectNames[0];

    if (!objectName || !objects?.[objectName]) {
      throw new Error("[Map] Invalid Topology payload: missing objects[0]");
    }

    const converted = topojson.feature(data, objects[objectName] as never) as unknown as GeoJSON.FeatureCollection;
    if (!converted || !Array.isArray(converted.features)) {
      throw new Error("[Map] Topology conversion returned invalid FeatureCollection");
    }
    geoJsonCache = converted;
  } else if (data?.type === "FeatureCollection" && Array.isArray(data?.features)) {
    geoJsonCache = data as GeoJSON.FeatureCollection;
  } else {
    throw new Error("[Map] Invalid geodata payload shape");
  }

  const palestineSourceFeatures = geoJsonCache.features.filter((feature) => {
    const p = feature.properties as Record<string, unknown> | null | undefined;
    const a2 = `${p?.ISO_A2 ?? p?.iso_a2 ?? p?.["ISO3166-1-Alpha-2"] ?? ""}`.toUpperCase();
    const a3 = `${p?.ISO_A3 ?? p?.iso_a3 ?? p?.["ISO3166-1-Alpha-3"] ?? ""}`.toUpperCase();
    const adm3 = `${p?.ADM0_A3 ?? p?.adm0_a3 ?? ""}`.toUpperCase();
    const name = `${p?.name ?? p?.NAME ?? p?.ADMIN ?? ""}`.trim().toLowerCase();

    return (
      a2 === "IL" ||
      a2 === "PS" ||
      a3 === "ISR" ||
      a3 === "PSE" ||
      adm3 === "ISR" ||
      adm3 === "PSE" ||
      adm3 === "PSX" ||
      name === "israel" ||
      name === "palestine"
    );
  });

  if (palestineSourceFeatures.length > 0) {
    const allPolygons: number[][][] = [];
    for (const feature of palestineSourceFeatures) {
      const geom = feature.geometry;
      if (!geom) continue;
      if (geom.type === "Polygon") {
        allPolygons.push(geom.coordinates as unknown as number[][]);
      } else if (geom.type === "MultiPolygon") {
        for (const poly of geom.coordinates) {
          allPolygons.push(poly as unknown as number[][]);
        }
      }
    }

    const normalizedPalestineFeature: GeoJSON.Feature = {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: allPolygons as unknown as GeoJSON.Position[][][],
      } as GeoJSON.MultiPolygon,
      properties: {
        name: "Palestine",
        NAME: "Palestine",
        ADMIN: "Palestine",
        NAME_LONG: "Palestine",
        FORMAL_EN: "State of Palestine",
        SOVEREIGNT: "Palestine",
        ISO_A2: "PS",
        ISO_A3: "PSE",
        ADM0_A3: "PSE",
        "ISO3166-1-Alpha-2": "PS",
        "ISO3166-1-Alpha-3": "PSE",
      },
    };

    geoJsonCache = {
      ...geoJsonCache,
      features: [
        normalizedPalestineFeature,
        ...geoJsonCache.features.filter((feature) => !palestineSourceFeatures.includes(feature)),
      ],
    };
  }

  if (!geoJsonCache.features.length) {
    const reason = "[Map] Invalid geodata payload: zero features";
    logWorldGeoEvent("error", "[Map] World GeoJSON load failed", {
      source: fetchSource,
      featureCount: 0,
      reason,
    });
    throw new Error(reason);
  }

  await setCachedWorldGeo(geoJsonCache, WORLD_GEOJSON_URL);
  logWorldGeoEvent("info", "[Map] World GeoJSON ready", {
    source: fetchSource,
    featureCount: geoJsonCache.features.length,
  });
  const codes = geoJsonCache.features.slice(0, 5).map((f) => ({
    ISO_A2: f.properties?.ISO_A2,
    ISO_A3: f.properties?.ISO_A3,
    name: f.properties?.name || f.properties?.NAME,
    resolved: getCountryCode(f),
  }));
  console.info("[Map] Sample codes:", codes);

  return geoJsonCache;
}

/* ── Main Component ── */
export const WorldMapLeaflet = forwardRef<LeafletMapHandle, LeafletMapProps>(function WorldMapLeaflet(props, ref) {
  const {
    countryStats, onCountrySelect, onRegionSelect, onCitySelect,
    onBackToCountry, onBackToWorld, onViewportChange,
    selectedCountryCode, drillLevel, isRtl,
    regionSummaries, visibleCountryCodes,
    citySummaries, cityUniversities, regionCities,
    osmOverlay, osmOverlayLoading, countryMeta,
    onCountryHover,
  } = props;

  const { resolvedTheme } = useTheme();
  const { t, language } = useLanguage();
  const mapText = useMemo(() => ({
    universities: t("home.worldMap.labels.universities"),
    programs: t("home.worldMap.labels.programs"),
    unknownCity: t("home.worldMap.labels.unknownCity"),
    universitiesWithoutCityCoordinates: t("home.worldMap.labels.universitiesWithoutCityCoordinates"),
    monthShort: t("home.worldMap.labels.monthShort"),
    studentHousingAvailable: t("home.worldMap.labels.studentHousingAvailable"),
    studentHousing: t("home.worldMap.labels.studentHousing"),
    viewUniversity: t("home.worldMap.labels.viewUniversity"),
    fromUniversity: t("home.worldMap.labels.fromUniversity"),
    universitiesWithoutExactCity: t("home.worldMap.labels.universitiesWithoutExactCity"),
  }), [t]);
  const getLocalizedValue = useMemo(() => {
    return (record: Record<string, unknown>, keyPrefix: string): string => {
      const byActiveLanguage = record[`${keyPrefix}_${language}`];
      if (typeof byActiveLanguage === "string" && byActiveLanguage.trim()) return byActiveLanguage;
      const englishValue = record[`${keyPrefix}_en`];
      if (typeof englishValue === "string" && englishValue.trim()) return englishValue;
      const arabicValue = record[`${keyPrefix}_ar`];
      if (typeof arabicValue === "string" && arabicValue.trim()) return arabicValue;
      return "";
    };
  }, [language]);
  const isDark = resolvedTheme === "dark";
  const [activeLayer, setActiveLayer] = useState<"satellite" | "streets" | "topo">("satellite");
  const [worldGeo, setWorldGeo] = useState<GeoJSON.FeatureCollection | null>(null);

  // Stable refs for boundary callbacks — read inside the giant effect via callbacksRef.current
  // so callback identity changes don't trigger full GeoJSON/marker rebuilds.
  const callbacksRef = useRef({ onCountrySelect, onRegionSelect, onCitySelect });
  useEffect(() => {
    callbacksRef.current = { onCountrySelect, onRegionSelect, onCitySelect };
  }, [onCountrySelect, onRegionSelect, onCitySelect]);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer[]>([]);
  const refLabelsRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<L.LayerGroup>(L.layerGroup());
  const bordersRef = useRef<L.GeoJSON | null>(null);
  const countryLabelsRef = useRef<L.LayerGroup>(L.layerGroup());
  const cityLabelsRef = useRef<L.LayerGroup>(L.layerGroup());

  // Highlight marker ref for search
  const highlightRef = useRef<L.CircleMarker | null>(null);

  // Zoom guard: prevents re-zoom when non-drill dependencies change (e.g. OSM overlay, theme)
  const lastZoomTargetRef = useRef<string>('');
  // Track whether user is manually zooming (to avoid fighting with auto-zoom)
  const userZoomingRef = useRef(false);

  // Expose flyTo to parent
  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lon: number, zoom = 13) => {
      const map = mapRef.current;
      if (!map) return;
      
      // Remove previous highlight
      if (highlightRef.current) {
        map.removeLayer(highlightRef.current);
        highlightRef.current = null;
      }

      map.flyTo([lat, lon], zoom, { animate: true, duration: 0.7, easeLinearity: 0.35 });
      
      // Add pulsing highlight circle after fly animation
      setTimeout(() => {
        if (!mapRef.current) return;
        const pulse = L.circleMarker([lat, lon], {
          radius: 18,
          color: "rgba(240,185,11,0.96)",
          fillColor: "rgba(240,185,11,0.96)",
          fillOpacity: 0.25,
          weight: 1.5,
          opacity: 0.9,
          className: 'search-highlight-pulse',
        }).addTo(mapRef.current);
        highlightRef.current = pulse;
        
        // Auto-remove after 6 seconds
        setTimeout(() => {
          if (highlightRef.current === pulse && mapRef.current) {
            mapRef.current.removeLayer(pulse);
            highlightRef.current = null;
          }
        }, 6000);
      }, 1600);
    },
  }), []);

  // Load world GeoJSON once
  useEffect(() => {
    let cancelled = false;

    loadWorldGeoJSON()
      .then((data) => {
        if (!cancelled) setWorldGeo(data);
      })
      .catch((err) => {
        const reason = err instanceof Error ? err.message : String(err);
        console.error("[Map] Interactive world layer unavailable", {
          reason,
          url: WORLD_GEOJSON_URL,
        });
        if (!cancelled) setWorldGeo(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const worldBounds = L.latLngBounds([[-60, -170], [75, 170]]);
    const map = L.map(containerRef.current, {
      minZoom: 1.75,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      preferCanvas: false,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1.0,
    });
    map.fitBounds(worldBounds, { padding: [40, 40] });
    // Create a custom pane for country borders with higher z-index than tiles
    const bordersPane = map.createPane('bordersPane');
    bordersPane.style.zIndex = '450';
    bordersPane.style.pointerEvents = 'auto';

    // Create pane for country name labels (above borders, below tooltips)
    const labelsPane = map.createPane('countryLabelsPane');
    labelsPane.style.zIndex = '460';
    labelsPane.style.pointerEvents = 'none';

    // Create pane for city name labels (above country labels, below tooltips)
    const cityLabelsPane = map.createPane('cityLabelsPane');
    cityLabelsPane.style.zIndex = '465';
    cityLabelsPane.style.pointerEvents = 'none';
    
    mapRef.current = map;
    markersRef.current.addTo(map);
    
    // Robust invalidateSize for mobile: multiple phases
    const invalidate = () => { if (mapRef.current) mapRef.current.invalidateSize(); };
    requestAnimationFrame(invalidate);
    const t1 = setTimeout(invalidate, 150);
    const t2 = setTimeout(invalidate, 500);
    const t3 = setTimeout(invalidate, 1200);
    
    const resizeObserver = new ResizeObserver(() => invalidate());
    resizeObserver.observe(containerRef.current);
    
    const onOrientationChange = () => setTimeout(invalidate, 300);
    const onVisibilityChange = () => { if (!document.hidden) setTimeout(invalidate, 200); };
    window.addEventListener('orientationchange', onOrientationChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', onOrientationChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      map.remove(); mapRef.current = null;
    };
  }, []);

  // ── Zoom-based automatic drill transitions ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onZoomEnd = () => {
      if (userZoomingRef.current) {
        userZoomingRef.current = false;
        return;
      }
      const z = map.getZoom();
      if (drillLevel === 'region' && z < 9) {
        onBackToCountry?.();
      } else if (drillLevel === 'country' && z < 2.5) {
        // Threshold lowered from 4.5 to 2.5 so antimeridian countries (RU at zoom 3) don't auto-back
        onBackToWorld?.();
      }
    };

    map.on('zoomend', onZoomEnd);
    return () => { map.off('zoomend', onZoomEnd); };
  }, [drillLevel, onBackToCountry, onBackToWorld]);

  // ── Emit viewport changes to parent ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onViewportChange) return;

    const emitViewport = () => {
      onViewportChange({
        zoom: map.getZoom(),
        bounds: map.getBounds(),
        activeCountryCode: resolveViewportCountryCode(map.getCenter(), worldGeo, countryStats),
      });
    };

    // Emit initial viewport
    emitViewport();

    map.on('moveend', emitViewport);
    map.on('zoomend', emitViewport);
    return () => {
      map.off('moveend', emitViewport);
      map.off('zoomend', emitViewport);
    };
  }, [onViewportChange, worldGeo, countryStats]);

  // Update tile layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const hdTileOptions: L.TileLayerOptions = {
      detectRetina: true,
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 4,
      crossOrigin: true,
    };

    tileRef.current.forEach(t => map.removeLayer(t));
    tileRef.current = [];
    if (activeLayer === "satellite") {
      tileRef.current = [
        L.tileLayer(TILES.satellite, { ...hdTileOptions, maxZoom: 18, className: isDark ? "map-layer--satellite-dark" : "map-layer--satellite-light" }).addTo(map),
      ];
    } else if (activeLayer === "streets") {
      tileRef.current = [L.tileLayer(isDark ? TILES.streetsDark : TILES.streetsLight, { ...hdTileOptions, maxZoom: 20, subdomains: 'abcd' }).addTo(map)];
    } else {
      tileRef.current = [L.tileLayer(TILES.topo, { ...hdTileOptions, maxZoom: 17, className: isDark ? "map-layer--topo-dark" : "map-layer--topo-light" }).addTo(map)];
    }
  }, [activeLayer, isDark]);

  // ── Reference labels layer (cities) — separate effect to avoid tile rebuild on drill change ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old reference labels if any
    if (refLabelsRef.current) {
      map.removeLayer(refLabelsRef.current);
      refLabelsRef.current = null;
    }

    // Only show reference labels in satellite mode when drilled into a country/region
    // Use reduced opacity at country level since we render our own city labels
    if (activeLayer === "satellite" && drillLevel !== "world") {
      refLabelsRef.current = L.tileLayer(TILES.referenceLabels, {
        detectRetina: false,
        tileSize: 128,
        zoomOffset: 1,
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 4,
        crossOrigin: true,
        maxZoom: 18,
        minZoom: 5,
        opacity: drillLevel === "country" ? 0.3 : 0.7,
        pane: 'overlayPane',
      }).addTo(map);
    }
  }, [activeLayer, drillLevel]);

  // ── Custom city name labels (rendered from citySummaries data) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    cityLabelsRef.current.clearLayers();

    // Only render when drilled into a country
    if (drillLevel !== "country" || !citySummaries || citySummaries.length === 0) {
      return;
    }

    cityLabelsRef.current.addTo(map);

    type ScreenRect = { x: number; y: number; width: number; height: number };

    const overlaps = (a: ScreenRect, b: ScreenRect) => !(
      a.x + a.width <= b.x || b.x + b.width <= a.x ||
      a.y + a.height <= b.y || b.y + b.height <= a.y
    );

    const renderCityLabels = () => {
      cityLabelsRef.current.clearLayers();
      const zoom = map.getZoom();
      const viewBounds = map.getBounds().pad(0.05);
      const placedRects: ScreenRect[] = [];

      // Sort cities by university count (largest first for priority)
      const sorted = [...citySummaries]
        .filter(c => c.city && c.city !== '__unknown__')
        .sort((a, b) => b.universities_count - a.universities_count);

      sorted.forEach((city) => {
        const resolved = resolveCityLocation(city);
        if (!resolved) return;

        const pos: L.LatLngExpression = [resolved.lat, resolved.lon];
        if (!viewBounds.contains(pos)) return;

        // Dynamic font size based on zoom level
        let fontSize: number;
        if (zoom >= 10) fontSize = 22;
        else if (zoom >= 8) fontSize = 20;
        else if (zoom >= 7) fontSize = 18;
        else if (zoom >= 6) fontSize = 16;
        else if (zoom >= 5) fontSize = 14;
        else fontSize = 13;

        // Boost font for cities with more universities
        if (city.universities_count >= 10) fontSize += 2;

        const charWidth = 0.65;
        const letterSpacing = fontSize >= 18 ? 2 : 1;
        const cityName = city.city || '';
        const labelWidth = Math.round(cityName.length * fontSize * charWidth + (cityName.length - 1) * letterSpacing + 12);
        const labelHeight = Math.round(fontSize * 1.5);

        // Position label below the city dot
        const point = map.project(pos, zoom);
        const dotOffset = 20;
        const rect: ScreenRect = {
          x: point.x - labelWidth / 2,
          y: point.y + dotOffset,
          width: labelWidth,
          height: labelHeight,
        };

        if (placedRects.some((existing) => overlaps(existing, rect))) return;
        placedRects.push(rect);

        // Offset the marker position to place label below the dot
        const offsetLatLng = map.unproject(
          L.point(point.x, point.y + dotOffset + labelHeight / 2),
          zoom
        );

        const label = L.marker([offsetLatLng.lat, offsetLatLng.lng], {
          icon: L.divIcon({
            className: "city-name-label",
            html: `<div style="
              width:${labelWidth}px;
              height:${labelHeight}px;
              display:flex;
              align-items:center;
              justify-content:center;
              font-family:'Arial','Helvetica Neue',sans-serif;
              font-size:${fontSize}px;
              font-weight:800;
              letter-spacing:${letterSpacing}px;
              color:rgba(255,255,255,0.97);
              text-shadow:0 0 4px rgba(0,0,0,1),0 0 8px rgba(0,0,0,0.9),0 1px 3px rgba(0,0,0,0.95),1px 0 3px rgba(0,0,0,0.8),-1px 0 3px rgba(0,0,0,0.8),0 2px 6px rgba(0,0,0,0.6);
              white-space:nowrap;
              pointer-events:none;
              text-align:center;
            ">${cityName}</div>`,
            iconSize: [labelWidth, labelHeight],
            iconAnchor: [labelWidth / 2, labelHeight / 2],
          }),
          interactive: false,
          pane: "cityLabelsPane",
        });
        cityLabelsRef.current.addLayer(label);
      });
    };

    renderCityLabels();
    map.on("zoomend", renderCityLabels);
    map.on("moveend", renderCityLabels);

    return () => {
      map.off("zoomend", renderCityLabels);
      map.off("moveend", renderCityLabels);
      cityLabelsRef.current.clearLayers();
    };
  }, [drillLevel, citySummaries]);


  useEffect(() => {
    const map = mapRef.current;
    if (!map || !worldGeo) return;

    type ScreenRect = { x: number; y: number; width: number; height: number };

    interface FeatureLabelInfo {
      name: string;
      lat: number;
      lng: number;
      bounds: L.LatLngBounds;
      labelBounds: L.LatLngBounds;
    }

    const getOuterRings = (geometry: GeoJSON.Geometry | null | undefined): number[][][] => {
      if (!geometry) return [];
      if (geometry.type === "Polygon") {
        return Array.isArray(geometry.coordinates?.[0]) ? [geometry.coordinates[0] as number[][]] : [];
      }
      if (geometry.type === "MultiPolygon") {
        return (geometry.coordinates as number[][][][])
          .map((polygon) => polygon?.[0] as number[][] | undefined)
          .filter((ring): ring is number[][] => Array.isArray(ring) && ring.length >= 3);
      }
      return [];
    };

    const ringArea = (ring: number[][]): number => {
      let sum = 0;
      for (let i = 0; i < ring.length - 1; i += 1) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        sum += x1 * y2 - x2 * y1;
      }
      return Math.abs(sum / 2);
    };

    const centroidOfRing = (ring: number[][]): { lat: number; lng: number } | null => {
      const a = ringArea(ring);
      if (a < 1e-6) return null;
      const signed = (() => { let s=0; for(let i=0;i<ring.length-1;i++){s+=ring[i][0]*ring[i+1][1]-ring[i+1][0]*ring[i][1];} return s/2; })();
      let cx=0, cy=0;
      for (let i=0;i<ring.length-1;i++){
        const cross=ring[i][0]*ring[i+1][1]-ring[i+1][0]*ring[i][1];
        cx+=(ring[i][0]+ring[i+1][0])*cross;
        cy+=(ring[i][1]+ring[i+1][1])*cross;
      }
      return { lng: cx/(6*signed), lat: cy/(6*signed) };
    };

    const pointInRing = (lat: number, lng: number, ring: number[][]): boolean => {
      let inside = false;
      for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
        const [xi,yi]=ring[i], [xj,yj]=ring[j];
        if (((yi>lat)!==(yj>lat)) && (lng<((xj-xi)*(lat-yi))/((yj-yi)||1e-9)+xi)) inside=!inside;
      }
      return inside;
    };

    // Precompute label info per feature (zoom-independent)
    const featureLabels: FeatureLabelInfo[] = [];
    worldGeo.features.forEach((feature) => {
      const p = feature.properties;
      const iso = getCountryCode(feature) || p?.ISO_A2 || p?.iso_a2 || "";
      const geoName = p?.NAME || p?.name || p?.ADMIN || "";
      // Use Intl.DisplayNames for the active language, fallback to GeoJSON name
      const name = iso
        ? getLocalizedCountryName(iso, language, geoName, geoName)
        : geoName;
      if (!name) return;

      try {
        const layer = L.geoJSON(feature);
        const bounds = layer.getBounds();
        if (!bounds.isValid()) return;

        // Find largest ring for sizing (not the full bounding box)
        const rings = getOuterRings(feature.geometry);
        const largest = rings
          .map(r => ({ ring: r, area: ringArea(r) }))
          .sort((a,b) => b.area - a.area)[0];

        // Compute bounds from largest ring only (avoids Alaska inflating US bbox)
        let labelBounds = bounds;
        if (largest?.ring && largest.ring.length > 2) {
          const lats = largest.ring.map(c => c[1]);
          const lngs = largest.ring.map(c => c[0]);
          const rb = L.latLngBounds(
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)]
          );
          if (rb.isValid()) labelBounds = rb;
        }

        // Use CC coordinates when available, else geometric centroid
        let lat: number, lng: number;
        if (iso && CC[iso]) {
          [lat, lng] = CC[iso];
        } else {
          lat = labelBounds.getCenter().lat;
          lng = labelBounds.getCenter().lng;
          if (largest?.ring) {
            const c = centroidOfRing(largest.ring);
            if (c && pointInRing(c.lat, c.lng, largest.ring)) {
              lat = c.lat;
              lng = c.lng;
            }
          }
        }

        featureLabels.push({ name, lat, lng, bounds, labelBounds });
      } catch { /* skip */ }
    });

    // Sort by geographic area (larger first for priority)
    featureLabels.sort((a, b) => {
      const areaA = (a.bounds.getNorth()-a.bounds.getSouth()) * (a.bounds.getEast()-a.bounds.getWest());
      const areaB = (b.bounds.getNorth()-b.bounds.getSouth()) * (b.bounds.getEast()-b.bounds.getWest());
      return areaB - areaA;
    });

    const overlaps = (a: ScreenRect, b: ScreenRect) => !(
      a.x + a.width <= b.x || b.x + b.width <= a.x ||
      a.y + a.height <= b.y || b.y + b.height <= a.y
    );

    countryLabelsRef.current.clearLayers();
    countryLabelsRef.current.addTo(map);
    if (activeLayer !== "satellite") return;

    const renderLabels = () => {
      countryLabelsRef.current.clearLayers();
      const zoom = map.getZoom();
      const viewBounds = map.getBounds().pad(0.05);
      const placedRects: ScreenRect[] = [];

      featureLabels.forEach((info) => {
        if (!viewBounds.contains([info.lat, info.lng])) return;

        // Use labelBounds (largest ring) for sizing, not full feature bounds
        const lb = info.labelBounds;
        const sw = map.project(lb.getSouthWest(), zoom);
        const ne = map.project(lb.getNorthEast(), zoom);
        const screenW = Math.abs(ne.x - sw.x);
        const screenH = Math.abs(sw.y - ne.y);

        // Skip countries too small on screen
        if (screenW < 14 || screenH < 8) return;

        // Calculate font size to fit within country bounds
        const targetLabelW = screenW * 0.6;
        const charWidth = 0.68;
        const maxFontFromWidth = Math.floor(targetLabelW / Math.max(info.name.length * charWidth, 2));
        const maxFontFromHeight = Math.floor(screenH * 0.3);
        let fontSize = Math.min(maxFontFromWidth, maxFontFromHeight);
        // Scale max font with zoom: at z≤4 cap at 14, grows up to 32 at z≥10
        const maxFont = zoom <= 4 ? 14 : Math.min(14 + (zoom - 4) * 4, 48);
        fontSize = Math.max(7, Math.min(fontSize, maxFont));

        const letterSpacing = fontSize >= 20 ? 4 : fontSize >= 13 ? 2 : fontSize >= 10 ? 1 : 0;
        let labelWidth = Math.round(info.name.length * fontSize * charWidth + (info.name.length - 1) * letterSpacing + 8);

        // Clamp: label must never exceed 85% of country screen width
        if (labelWidth > screenW * 0.85) {
          fontSize = Math.floor((screenW * 0.85) / Math.max(info.name.length * charWidth, 2));
          if (fontSize < 7) return; // too small even at min
          labelWidth = Math.round(info.name.length * fontSize * charWidth + (info.name.length - 1) * letterSpacing + 8);
        }

        const labelHeight = Math.round(fontSize * 1.6);

        const point = map.project([info.lat, info.lng], zoom);
        const rect: ScreenRect = {
          x: point.x - labelWidth / 2,
          y: point.y - labelHeight / 2,
          width: labelWidth,
          height: labelHeight,
        };

        if (placedRects.some((existing) => overlaps(existing, rect))) return;
        placedRects.push(rect);

        const label = L.marker([info.lat, info.lng], {
          icon: L.divIcon({
            className: "country-name-label",
            html: `<div style="
              width:${labelWidth}px;
              height:${labelHeight}px;
              display:flex;
              align-items:center;
              justify-content:center;
              font-family:'Arial','Helvetica Neue',sans-serif;
              font-size:${fontSize}px;
              font-weight:700;
              letter-spacing:${letterSpacing}px;
              color:rgba(255,255,255,0.95);
              text-shadow:0 0 3px rgba(0,0,0,1),0 0 6px rgba(0,0,0,0.9),0 1px 2px rgba(0,0,0,0.95),1px 0 2px rgba(0,0,0,0.7),-1px 0 2px rgba(0,0,0,0.7);
              white-space:nowrap;
              text-transform:uppercase;
              pointer-events:none;
              text-align:center;
            ">${info.name}</div>`,
            iconSize: [labelWidth, labelHeight],
            iconAnchor: [labelWidth / 2, labelHeight / 2],
          }),
          interactive: false,
          pane: "countryLabelsPane",
        });
        countryLabelsRef.current.addLayer(label);
      });
    };

    renderLabels();
    map.on("zoomend", renderLabels);
    map.on("moveend", renderLabels);

    return () => {
      map.off("zoomend", renderLabels);
      map.off("moveend", renderLabels);
      countryLabelsRef.current.clearLayers();
    };
  }, [worldGeo, activeLayer, language]);

  // Background
  useEffect(() => {
    if (containerRef.current) containerRef.current.style.background = isDark ? "#0f1729" : "#a3c8e8";
  }, [isDark]);

  // ── Build country borders + markers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Compute zoom target key — only zoom when drill target actually changes
    const zoomTargetKey = `${drillLevel}|${selectedCountryCode}|${regionCities?.join(',') ?? ''}|${visibleCountryCodes ? [...visibleCountryCodes].sort().join(',') : 'all'}`;
    const shouldZoom = zoomTargetKey !== lastZoomTargetRef.current;
    if (shouldZoom) {
      lastZoomTargetRef.current = zoomTargetKey;
      // Mark programmatic zoom so zoomend listener doesn't trigger drill transitions
      userZoomingRef.current = true;
    }

    // Clear previous
    const group = markersRef.current;
    group.clearLayers();
    if (bordersRef.current) {
      map.removeLayer(bordersRef.current);
      bordersRef.current = null;
    }

    const selectedCountryFeatures =
      drillLevel !== "world" && selectedCountryCode && worldGeo
        ? worldGeo.features.filter((feature) => getCountryCode(feature) === selectedCountryCode)
        : [];

    if (selectedCountryFeatures.length > 0) {
      const selectedCountryLayer = L.geoJSON(
        {
          type: "FeatureCollection",
          features: selectedCountryFeatures,
        } as GeoJSON.FeatureCollection,
        {
          pane: "bordersPane",
          style: {
            fillOpacity: 0.14,
            fillColor: isDark ? GOLD.fillDark : GOLD.fillLight,
            color: isDark ? GOLD.strokeDarkHover : GOLD.strokeLightHover,
            weight: 2,
          },
        },
      );
      selectedCountryLayer.addTo(map);
      selectedCountryLayer.bringToFront();
      bordersRef.current = selectedCountryLayer;
    }

    // ── WORLD level ──
    if (drillLevel === "world" && countryStats && worldGeo) {
      // Build set of countries that have actual data after filtering
      const activeCountries = new Set(
        Object.entries(countryStats)
          .filter(([, v]) => v.universities_count > 0)
          .map(([k]) => k)
      );

      // Add GeoJSON borders with filter-aware styling
      // Check if any filter is active (not default state)
      const hasActiveFilter = visibleCountryCodes !== null || activeCountries.size < Object.keys(countryStats).length;

      const geoLayer = L.geoJSON(worldGeo, {
        pane: 'bordersPane',
        style: (feature) => {
          if (!feature) return {};
          const code = getCountryCode(feature);
          const hasData = code && activeCountries.has(code);
          const isVisible = !visibleCountryCodes || (code && visibleCountryCodes.has(code));
          const isFiltered = visibleCountryCodes && code && !visibleCountryCodes.has(code);

          // Outside selected region → keep it unobtrusive without covering the basemap
          if (isFiltered) {
            return {
              fillOpacity: 0,
              color: isDark ? BORDER.filteredDark : BORDER.filteredLight,
              weight: 0.3,
            };
          }

          // Has data + visible → white/light border (Google Maps style), gold only on hover
          if (hasData && isVisible) {
            return {
              fillOpacity: isDark ? 0.26 : 0.16,
              fillColor: isDark ? GOLD.fillDark : GOLD.fillLight,
              color: isDark ? BORDER.defaultDark : BORDER.defaultLight,
              weight: 0.8,
            };
          }

          // Visible but no data → very subtle border
          if (isVisible) {
            return {
              fillOpacity: 0,
              color: isDark ? BORDER.noDataDark : BORDER.noDataLight,
              weight: 0.4,
            };
          }

          // Default: faint neutral border
          return {
            fillOpacity: 0,
            color: isDark ? BORDER.filteredDark : BORDER.filteredLight,
            weight: 0.3,
          };
        },
        onEachFeature: (feature, layer) => {
          const code = getCountryCode(feature);
          const info = code ? countryStats[code] : null;
          if (!info || info.universities_count === 0) return;

          const isVisible = !visibleCountryCodes || (code && visibleCountryCodes.has(code));
          if (!isVisible) return;

          const name = code
            ? getLocalizedCountryName(code, language, (info as any).country_name_ar, (info as any).country_name_en)
            : getLocalizedValue(info as unknown as Record<string, unknown>, "country_name");
          const meta = code ? countryMeta?.[code] : null;
          const imgUrl = meta?.image_url || null;
          const imgHtml = imgUrl
            ? `<img src="${imgUrl}" alt="" style="width:100%;height:90px;object-fit:cover;display:block;border-radius:6px 6px 0 0;" onerror="this.style.display='none'" />`
            : '';
          const ic = (d: string, c: string) => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-${isRtl?'left':'right'}:4px"><path d="${d}"/></svg>`;
          const uniIcon = ic('M2 20h20M4 20V9l8-5 8 5v11M9 20v-5h6v5', isDark ? '#60a5fa' : '#3b82f6');
          const progIcon = ic('M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20', isDark ? '#a78bfa' : '#7c3aed');
          const feeIcon = ic('M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', isDark ? '#34d399' : '#059669');
          layer.bindTooltip(`
            <div style="font-family:system-ui;font-size:11px;direction:${isRtl ? 'rtl' : 'ltr'};width:160px;overflow:hidden;border-radius:6px;background:${isDark ? '#1a1a2e' : '#fff'};box-shadow:0 2px 12px rgba(0,0,0,0.25);border:1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'};">
              ${imgHtml}
              <div style="padding:6px 8px;text-align:${isRtl ? 'right' : 'left'}">
                <div style="font-weight:700;font-size:12px;margin-bottom:3px;color:${isDark ? '#f1f1f1' : '#111'}">${name}</div>
                <div style="color:${isDark ? '#ccc' : '#555'};margin-bottom:2px;line-height:1.4">${uniIcon}${info.universities_count.toLocaleString()} ${mapText.universities}</div>
                <div style="color:${isDark ? '#ccc' : '#555'};margin-bottom:2px;line-height:1.4">${progIcon}${info.programs_count.toLocaleString()} ${mapText.programs}</div>
                ${info.fee_min != null && info.fee_max != null ? `<div style="color:${isDark ? '#aaa' : '#777'};line-height:1.4">${feeIcon}$${info.fee_min.toLocaleString()} – $${info.fee_max.toLocaleString()}</div>` : ''}
              </div>
            </div>
          `, { direction: "top", className: "leaflet-country-card-tooltip", sticky: true, opacity: 1 });

          layer.on({
            mouseover: (e: L.LeafletMouseEvent) => {
              const l = e.target;
              l.setStyle({
                fillOpacity: isDark ? 0.34 : 0.24,
                fillColor: isDark ? GOLD.fillDarkHover : GOLD.fillLightHover,
                color: isDark ? GOLD.strokeDarkHover : GOLD.strokeLightHover,
                weight: 2.5,
              });
              l.bringToFront();
              if (code) onCountryHover?.(code);
            },
            mouseout: (e: L.LeafletMouseEvent) => {
              geoLayer.resetStyle(e.target);
              onCountryHover?.(null);
            },
            click: () => {
              if (code) callbacksRef.current.onCountrySelect(code);
            },
          });
        },
      });

      geoLayer.addTo(map);
      bordersRef.current = geoLayer;

      // No dots — lighting is purely via country fill/border styling above

      // Fit to visible countries
      // Predefined continent bounds [SW, NE] for proper framing
      const CONTINENT_BOUNDS: Record<string, [[number,number],[number,number]]> = {
        asia:          [[-12, 25],  [55, 155]],
        europe:        [[33, -28],  [73, 60]],
        africa:        [[-36, -22], [40, 55]],
        north_america: [[5, -170],  [75, -50]],
        south_america: [[-58, -85], [15, -32]],
        oceania:       [[-50, 108], [2, 182]],
      };

      // Countries to exclude from bounds calculation (they span too far and distort the view)
      const BOUNDS_EXCLUDE: Record<string, Set<string>> = {
        europe: new Set(["RU"]),
      };

      // Detect which region filter is active — match if ≥60% of visible codes belong to a continent
      const CONTINENT_CODES: Record<string, Set<string>> = {
        asia: new Set(["CN","JP","KR","IN","PK","ID","MY","TH","VN","PH","IR","IQ","SA","AE","QA","KW","BH","OM","JO","LB","SY","YE","AF","BD","LK","NP","MM","KH","LA","SG","BN","TW","MN","KZ","UZ","TM","KG","TJ","GE","AM","AZ"]),
        europe: new Set(["RU","DE","FR","GB","IT","ES","PL","UA","NL","BE","SE","NO","DK","FI","AT","CH","CZ","PT","GR","HU","RO","BG","HR","SK","IE","LT","LV","EE","SI","RS","BA","AL","MK","ME","MD","BY","IS","MT","CY","LU","TR"]),
        africa: new Set(["EG","NG","ZA","MA","TN","DZ","KE","GH","ET","TZ","UG","SN","CM","CI","MG","MZ","AO","SD","LY","ZW","ZM","BW","NA","RW","ML"]),
        north_america: new Set(["US","CA","MX","GT","CU","HN","SV","NI","CR","PA","JM","HT","DO","TT","BS"]),
        south_america: new Set(["BR","AR","CO","PE","VE","CL","EC","BO","PY","UY","GY","SR"]),
        oceania: new Set(["AU","NZ","FJ","PG","WS"]),
      };

      let activeRegionKey: string | null = null;
      if (visibleCountryCodes && visibleCountryCodes.size > 0) {
        const arr = [...visibleCountryCodes];
        let bestKey: string | null = null;
        let bestRatio = 0;
        for (const [key, codes] of Object.entries(CONTINENT_CODES)) {
          const matched = arr.filter(c => codes.has(c)).length;
          const ratio = matched / arr.length;
          if (ratio > bestRatio) { bestRatio = ratio; bestKey = key; }
        }
        if (bestKey && bestRatio >= 0.6) activeRegionKey = bestKey;
      }

      if (shouldZoom) {
        if (activeRegionKey && CONTINENT_BOUNDS[activeRegionKey]) {
          const [sw, ne] = CONTINENT_BOUNDS[activeRegionKey];
          map.fitBounds(L.latLngBounds(L.latLng(sw[0], sw[1]), L.latLng(ne[0], ne[1])), { animate: true, padding: [50, 50] });
        } else if (visibleCountryCodes) {
          const excludeSet = activeRegionKey ? BOUNDS_EXCLUDE[activeRegionKey] : undefined;
          const activeCodes = [...activeCountries].filter(c => visibleCountryCodes.has(c) && CC[c] && !(excludeSet?.has(c)));
          const fitCodes = activeCodes.length > 0 ? activeCodes : Object.keys(countryStats).filter(c => visibleCountryCodes.has(c) && CC[c] && !(excludeSet?.has(c)));
          if (fitCodes.length > 0) {
            const pts = fitCodes.map(c => L.latLng(CC[c][0], CC[c][1]));
            map.fitBounds(L.latLngBounds(pts).pad(0.3), { animate: true, maxZoom: 4, padding: [40, 40] });
          }
        } else {
          const worldBounds = L.latLngBounds([[-60, -170], [75, 170]]);
          map.fitBounds(worldBounds, { animate: true, padding: [10, 10] });
        }
      }
    }

    // ── COUNTRY level: city dots ──
    if (drillLevel === "country" && citySummaries) {
      const pts: L.LatLng[] = [];
      let unknownUniversitiesCount = 0;

      citySummaries.forEach((city) => {
        const resolved = resolveCityLocation(city);
        if (!resolved) {
          unknownUniversitiesCount += city.universities_count;
          return;
        }

        const pos: [number, number] = [resolved.lat, resolved.lon];
        pts.push(L.latLng(pos[0], pos[1]));
        const m = L.marker(pos, { icon: cityDotIcon(city.universities_count, isDark, selectedCountryCode || undefined) });
        m.bindTooltip(`
          <div style="font-family:system-ui;font-size:12px;direction:${isRtl ? 'rtl' : 'ltr'};text-align:${isRtl ? 'right' : 'left'}">
            <div style="font-weight:800;font-size:14px;margin-bottom:4px">${city.city}</div>
            <div style="display:flex;gap:8px;opacity:0.85;font-size:11px">
              <span>🎓 ${city.universities_count} ${mapText.universities}</span>
              <span>📚 ${city.programs_count} ${mapText.programs}</span>
            </div>
            ${city.fee_min != null && city.fee_max != null ? `<div style="font-size:10px;opacity:0.7;margin-top:3px">💰 $${city.fee_min.toLocaleString()} – $${city.fee_max.toLocaleString()}</div>` : ''}
          </div>
        `, { direction: "top", offset: [0, -8], className: "leaflet-custom-tooltip", sticky: true });
        m.on("click", () => {
          if (onCitySelect && city.city) {
            onCitySelect(city.city);
          } else {
            const region = regionSummaries.find(r =>
              r.cities.some(c => c.toLowerCase() === city.city?.toLowerCase())
            );
            if (region) onRegionSelect(region.regionId);
          }
        });
        group.addLayer(m);
      });

      if (unknownUniversitiesCount > 0 && selectedCountryCode && CC[selectedCountryCode]) {
        const unknownPos: [number, number] = [CC[selectedCountryCode][0], CC[selectedCountryCode][1]];
        pts.push(L.latLng(unknownPos[0], unknownPos[1]));
        const unknownCityLabel = mapText.unknownCity;
        const unknownMarker = L.marker(unknownPos, { icon: cityDotIcon(unknownUniversitiesCount, isDark, selectedCountryCode || undefined) });
        unknownMarker.bindTooltip(`
          <div style="font-family:system-ui;font-size:12px;direction:${isRtl ? 'rtl' : 'ltr'};text-align:${isRtl ? 'right' : 'left'}">
            <div style="font-weight:800;font-size:14px;margin-bottom:4px">${unknownCityLabel}</div>
            <div style="opacity:0.85">🎓 ${unknownUniversitiesCount} ${mapText.universitiesWithoutCityCoordinates}</div>
          </div>
        `, { direction: "top", offset: [0, -8], className: "leaflet-custom-tooltip", sticky: true });
        unknownMarker.on("click", () => {
          if (onCitySelect) onCitySelect("__unknown__");
        });
        group.addLayer(unknownMarker);
      }

      // Country-level zoom — build bounds from selectedCountryFeatures directly
      if (shouldZoom) {
        // Explicit antimeridian fallback set — these countries have geometries
        // that cross ±180° and produce broken Leaflet bounds
        const ANTIMERIDIAN_COUNTRIES = new Set(["RU", "FJ", "NZ"]);
        const useAntimeridianFallback = selectedCountryCode && ANTIMERIDIAN_COUNTRIES.has(selectedCountryCode);

        // Build bounds from the selected country features directly (not bordersRef which may contain other layers)
        let featureBounds: L.LatLngBounds | null = null;
        if (!useAntimeridianFallback && selectedCountryFeatures.length > 0) {
          try {
            const tempLayer = L.geoJSON({
              type: "FeatureCollection",
              features: selectedCountryFeatures,
            } as GeoJSON.FeatureCollection);
            const b = tempLayer.getBounds();
            if (b.isValid()) featureBounds = b;
          } catch { /* skip */ }
        }

        // Determine zoom path
        let zoomPath: string;
        if (useAntimeridianFallback) {
          if (selectedCountryCode && CC[selectedCountryCode]) {
            // Use setView (not flyTo) to avoid intermediate zoomend events
            // that would trigger the auto-back-to-world guard (z < 4.5)
            const amZoom = selectedCountryCode === "RU" ? 3 : 5;
            map.setView(CC[selectedCountryCode], amZoom, { animate: true, duration: 1 });
            // Re-arm the programmatic-zoom guard so the single zoomend is also suppressed
            userZoomingRef.current = true;
            zoomPath = 'setView:antimeridian';
          } else {
            // No CC entry — last resort world view (should not happen for RU/FJ/NZ)
            map.flyTo([0, 0], 2, { animate: true });
            zoomPath = 'flyTo:antimeridian:no-CC';
          }
        } else if (featureBounds) {
          map.fitBounds(featureBounds.pad(0.08), {
            animate: true,
            padding: [40, 40],
            maxZoom: 6,
          });
          zoomPath = 'fitBounds:featureGeometry';
        } else if (pts.length > 0) {
          map.fitBounds(L.latLngBounds(pts).pad(0.2), {
            animate: true,
            maxZoom: 7,
            padding: [50, 50],
          });
          zoomPath = 'fitBounds:cityPoints';
        } else if (selectedCountryCode && CC[selectedCountryCode]) {
          map.flyTo(CC[selectedCountryCode], 5, { animate: true });
          zoomPath = 'flyTo:CC-fallback';
        } else {
          zoomPath = 'none:no-data';
        }

        // Runtime evidence log
        setTimeout(() => {
          const c = map.getCenter();
          console.log('[Map:CountryZoom]', {
            selectedCountryCode,
            antimeridianFallback: !!useAntimeridianFallback,
            featureBoundsValid: !!featureBounds,
            path: zoomPath,
            finalCenter: { lat: c.lat.toFixed(2), lng: c.lng.toFixed(2) },
            finalZoom: map.getZoom().toFixed(2),
          });
        }, 1200);
      }
    }

    // ── REGION level: university pins with precise geo + dorm markers ──
    if (drillLevel === "region" && cityUniversities && regionCities && citySummaries) {
      const citySet = new Set(regionCities.map(c => c.toLowerCase()));
      const selectedCityKey = regionCities.length === 1 ? regionCities[0].toLowerCase() : null;
      const selectedCitySummary = selectedCityKey
        ? citySummaries.find((c) => c.city?.toLowerCase() === selectedCityKey) || null
        : null;
      const cityCoordsMap = buildCityCoordsMap(citySummaries);

      const pts: L.LatLng[] = [];
      const filtered = cityUniversities.filter(u => u.city && citySet.has(u.city.toLowerCase()));
      let universitiesWithoutCoords = 0;

      // Check if OSM overlay actually has any verified (non-city-fallback) matches
      const osmHasVerifiedMatches = osmOverlay && osmOverlay.size > 0 &&
        Array.from(osmOverlay.values()).some(m => m.match_status === 'matched' && m.lat != null);

      filtered.forEach((uni) => {
        // Use unified geo resolver
        const resolved = resolveUniversityLocation(uni, osmOverlay, cityCoordsMap);

        if (!resolved) {
          universitiesWithoutCoords += 1;
          return;
        }

        // Only skip city-center fallback markers when OSM has verified positions for SOME universities
        // If OSM returned zero verified matches, city-center is the best we have — use it
        if (osmHasVerifiedMatches && isCityFallback(resolved)) {
          universitiesWithoutCoords += 1;
          return;
        }

        const pos: [number, number] = [resolved.lat, resolved.lon];
        pts.push(L.latLng(pos[0], pos[1]));

        const m = L.marker(pos, { icon: uniMarkerIcon(uni.university_logo, isDark) });
        const uniName = getLocalizedValue(uni as unknown as Record<string, unknown>, "university_name");

        // Tooltip on hover — shows name, programs, and housing info
        const dormInfo = uni.has_dorm && uni.dorm_address
          ? `<div style="display:flex;align-items:center;gap:4px;margin-top:4px;font-size:11px;color:${isDark ? '#fbbf24' : '#d97706'}">🏠 ${uni.dorm_address}${uni.dorm_price_monthly_local ? ` • ${uni.dorm_price_monthly_local.toLocaleString()} ${uni.dorm_currency_code || ''}/${mapText.monthShort}` : ''}</div>`
          : uni.has_dorm
          ? `<div style="display:flex;align-items:center;gap:4px;margin-top:4px;font-size:11px;color:${isDark ? '#fbbf24' : '#d97706'}">🏠 ${mapText.studentHousingAvailable}</div>`
          : '';

        m.bindTooltip(`
          <div style="font-family:system-ui;font-size:12px;direction:${isRtl ? 'rtl' : 'ltr'};text-align:${isRtl ? 'right' : 'left'};min-width:180px">
            <div style="font-weight:800;font-size:13px;margin-bottom:4px;line-height:1.3">${uniName}</div>
            <div style="display:flex;gap:8px;opacity:0.85;font-size:11px">
              <span>📚 ${uni.programs_count} ${mapText.programs}</span>
              ${uni.fee_min != null ? `<span>💰 $${uni.fee_min.toLocaleString()}</span>` : ''}
            </div>
            ${dormInfo}
          </div>
        `, { direction: "top", offset: [0, -24], className: "leaflet-custom-tooltip", sticky: true });

        // Popup on click
        const logoHtml = uni.university_logo
          ? `<img src="${uni.university_logo}" style="width:44px;height:44px;border-radius:10px;object-fit:contain;border:1px solid ${isDark ? 'rgba(100,116,139,0.3)' : '#e5e7eb'};background:${isDark ? '#1e293b' : '#fff'}" />`
          : `<div style="width:44px;height:44px;border-radius:10px;background:${isDark ? '#1e293b' : '#f3f4f6'};display:flex;align-items:center;justify-content:center;font-size:20px">🏛️</div>`;

        m.bindPopup(`
          <div style="font-family:system-ui;direction:${isRtl ? 'rtl' : 'ltr'};min-width:220px;max-width:300px;padding:4px">
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
              ${logoHtml}
              <div style="min-width:0;flex:1">
                <div style="font-weight:800;font-size:13px;line-height:1.3;color:${isDark ? '#f1f5f9' : '#0f172a'}">${uniName}</div>
                ${uni.city ? `<div style="font-size:11px;color:${isDark ? '#94a3b8' : '#6b7280'};margin-top:2px;display:flex;align-items:center;gap:3px">📍 ${uni.city}</div>` : ''}
              </div>
            </div>
            <div style="display:flex;gap:10px;font-size:11px;color:${isDark ? '#94a3b8' : '#6b7280'};padding:6px 0;border-top:1px solid ${isDark ? 'rgba(51,65,85,0.5)' : 'rgba(0,0,0,0.06)'}">
              <span style="display:flex;align-items:center;gap:3px">📚 ${uni.programs_count} ${mapText.programs}</span>
              ${uni.fee_min != null ? `<span style="display:flex;align-items:center;gap:3px">💰 $${uni.fee_min.toLocaleString()}${uni.fee_max != null ? ` – $${uni.fee_max.toLocaleString()}` : ''}</span>` : ''}
            </div>
            ${uni.has_dorm ? `<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:${isDark ? '#fbbf24' : '#d97706'};padding:4px 0;border-top:1px solid ${isDark ? 'rgba(51,65,85,0.5)' : 'rgba(0,0,0,0.06)'}">🏠 ${uni.dorm_address || mapText.studentHousing}${uni.dorm_price_monthly_local ? ` • ${uni.dorm_price_monthly_local.toLocaleString()} ${uni.dorm_currency_code || ''}` : ''}</div>` : ''}
            <a href="/university/${uni.university_id}" style="display:block;text-align:center;font-size:12px;font-weight:700;color:#fff;background:hsl(var(--primary));border-radius:8px;padding:8px 12px;margin-top:4px;text-decoration:none;transition:opacity 0.15s" onmouseenter="this.style.opacity='0.9'" onmouseleave="this.style.opacity='1'">
              ${mapText.viewUniversity}
            </a>
          </div>
        `, { maxWidth: 300, minWidth: 220, className: 'leaflet-uni-popup' });
        group.addLayer(m);

        // ── Dorm marker + dashed polyline ──
        if (uni.has_dorm && uni.dorm_lat != null && uni.dorm_lon != null) {
          const dormPos: [number, number] = [uni.dorm_lat, uni.dorm_lon];
          const dormMarker = L.marker(dormPos, { icon: dormMarkerIcon(isDark) });
          
          // Calculate distance
          const uniLatLng = L.latLng(pos[0], pos[1]);
          const dormLatLng = L.latLng(dormPos[0], dormPos[1]);
          const distanceKm = (uniLatLng.distanceTo(dormLatLng) / 1000).toFixed(1);

          dormMarker.bindTooltip(`
            <div style="font-family:system-ui;font-size:12px;direction:${isRtl ? 'rtl' : 'ltr'};text-align:${isRtl ? 'right' : 'left'}">
              <div style="font-weight:800;font-size:12px;color:${isDark ? '#fbbf24' : '#d97706'};margin-bottom:3px">🏠 ${mapText.studentHousing}</div>
              <div style="font-size:11px;opacity:0.9;margin-bottom:2px">${uniName}</div>
              ${uni.dorm_address ? `<div style="font-size:10px;opacity:0.7">📍 ${uni.dorm_address}</div>` : ''}
              ${uni.dorm_price_monthly_local ? `<div style="font-size:10px;opacity:0.7;margin-top:2px">💰 ${uni.dorm_price_monthly_local.toLocaleString()} ${uni.dorm_currency_code || ''}/${mapText.monthShort}</div>` : ''}
              <div style="font-size:10px;opacity:0.6;margin-top:3px">📏 ${distanceKm} km ${mapText.fromUniversity}</div>
            </div>
          `, { direction: "top", offset: [0, -18], className: "leaflet-custom-tooltip", sticky: true });
          group.addLayer(dormMarker);
          pts.push(dormLatLng);

          // Dashed polyline connecting university to dorm
          const polyline = L.polyline([pos, dormPos], {
            color: isDark ? 'rgba(251,191,36,0.7)' : 'rgba(217,119,6,0.6)',
            weight: 2.5,
            dashArray: '8, 6',
            opacity: 0.8,
          });
          group.addLayer(polyline);
        }
      });

      if (universitiesWithoutCoords > 0 && selectedCountryCode) {
        // Use selected city coords as fallback position (not country center which can be thousands of km away)
        const fallbackPos: [number, number] | null =
          selectedCitySummary?.city_lat != null && selectedCitySummary?.city_lon != null
            ? [selectedCitySummary.city_lat, selectedCitySummary.city_lon]
            : CC[selectedCountryCode]
              ? [CC[selectedCountryCode][0], CC[selectedCountryCode][1]]
              : null;
        if (fallbackPos) {
          // Do NOT push into pts — fallback marker must not distort map bounds
          const fallbackMarker = L.marker(fallbackPos, { icon: cityDotIcon(universitiesWithoutCoords, isDark, selectedCountryCode || undefined) });
          fallbackMarker.bindTooltip(`
            <div style="font-family:system-ui;font-size:12px;direction:${isRtl ? 'rtl' : 'ltr'};text-align:${isRtl ? 'right' : 'left'}">
              <div style="font-weight:800;font-size:14px;margin-bottom:4px">${mapText.universitiesWithoutExactCity}</div>
              <div style="opacity:0.85">🎓 ${universitiesWithoutCoords} ${mapText.universities}</div>
            </div>
          `, { direction: "top", offset: [0, -8], className: "leaflet-custom-tooltip", sticky: true });
          group.addLayer(fallbackMarker);
        }
      }

      if (shouldZoom) {
        if (pts.length === 1) {
          map.flyTo(pts[0], 12, { animate: true, duration: 0.65, easeLinearity: 0.35 });
        } else if (pts.length > 1) {
          map.fitBounds(L.latLngBounds(pts).pad(0.24), { animate: true, duration: 0.55, easeLinearity: 0.35, maxZoom: 12 });
        } else if (selectedCitySummary?.city_lat != null && selectedCitySummary?.city_lon != null) {
          map.flyTo([selectedCitySummary.city_lat, selectedCitySummary.city_lon], 11, {
            animate: true,
            duration: 0.65,
            easeLinearity: 0.35,
          });
        }
      }
    }
  }, [drillLevel, countryStats, visibleCountryCodes, citySummaries, cityUniversities, regionCities, regionSummaries, selectedCountryCode, isDark, isRtl, mapText, getLocalizedValue, worldGeo, osmOverlay, countryMeta]);

  return (
    <div className="relative w-full h-full">
      {/* Layer switcher */}
      <div className="absolute top-4 z-[1001] flex flex-col gap-1.5 pointer-events-auto" style={{ right: '16px' }}>
        {/* Zoom Controls */}
        <button
          onClick={() => mapRef.current?.zoomIn()}
          title={t("home.worldMap.controls.zoomIn")}
          className="w-9 h-9 rounded-lg shadow-md flex items-center justify-center transition-all text-lg font-bold border bg-background/80 backdrop-blur-md border-border text-foreground hover:bg-primary/20 hover:text-primary hover:border-primary/50"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          title={t("home.worldMap.controls.zoomOut")}
          className="w-9 h-9 rounded-lg shadow-md flex items-center justify-center transition-all text-lg font-bold border bg-background/80 backdrop-blur-md border-border text-foreground hover:bg-primary/20 hover:text-primary hover:border-primary/50"
        >
          −
        </button>

        {/* Divider */}
        <div className="h-px bg-border/50 mx-1" />

        {/* Layer switcher */}
        {([
          { key: "satellite" as const, label: "🛰️", title: t("home.worldMap.controls.layers.satellite") },
          { key: "streets" as const, label: "🗺️", title: t("home.worldMap.controls.layers.streets") },
          { key: "topo" as const, label: "⛰️", title: t("home.worldMap.controls.layers.topo") },
        ]).map(({ key, label, title }) => (
          <button
            key={key}
            onClick={() => setActiveLayer(key)}
            title={title}
            className={`w-9 h-9 rounded-lg shadow-md flex items-center justify-center transition-all text-sm border ${
              activeLayer === key
                ? "bg-primary/20 backdrop-blur-md border-primary/50 text-primary"
                : "bg-background/80 backdrop-blur-md border-border text-muted-foreground hover:bg-background"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="absolute inset-0" />

      <style>{`
        .leaflet-custom-tooltip {
          background: ${isDark ? "rgba(15,23,42,0.97)" : "rgba(255,255,255,0.98)"} !important;
          color: ${isDark ? "#f1f5f9" : "#1e293b"} !important;
          border: 1px solid ${isDark ? "rgba(253,224,71,0.42)" : "rgba(240,185,11,0.38)"} !important;
          border-radius: 12px !important;
          padding: 10px 14px !important;
          box-shadow: 0 8px 30px rgba(0,0,0,${isDark ? "0.4" : "0.12"}), 0 2px 8px rgba(0,0,0,${isDark ? "0.2" : "0.06"}) !important;
          backdrop-filter: blur(12px) !important;
        }
        .leaflet-custom-tooltip::before {
          border-top-color: ${isDark ? "rgba(15,23,42,0.97)" : "rgba(255,255,255,0.98)"} !important;
        }
        .leaflet-popup-content-wrapper,
        .leaflet-uni-popup .leaflet-popup-content-wrapper {
          border-radius: 16px !important;
          box-shadow: 0 10px 40px rgba(0,0,0,${isDark ? "0.5" : "0.15"}), 0 4px 12px rgba(0,0,0,${isDark ? "0.3" : "0.08"}) !important;
          ${isDark ? "background: rgba(15,23,42,0.97) !important; color: #f1f5f9 !important;" : "background: rgba(255,255,255,0.99) !important;"}
          backdrop-filter: blur(16px) !important;
          padding: 4px !important;
        }
        .leaflet-popup-content {
          margin: 10px 12px !important;
        }
        .leaflet-popup-tip {
          ${isDark ? "background: rgba(15,23,42,0.97) !important;" : "background: rgba(255,255,255,0.99) !important;"}
          box-shadow: 0 4px 8px rgba(0,0,0,0.1) !important;
        }
        .leaflet-popup-close-button {
          color: ${isDark ? "#94a3b8" : "#6b7280"} !important;
          font-size: 18px !important;
          top: 6px !important;
          right: 8px !important;
        }
        .map-layer--satellite-light {
          filter: ${TILE_FILTERS.satellite.light};
        }
        .map-layer--satellite-dark {
          filter: ${TILE_FILTERS.satellite.dark};
        }
        .map-layer--topo-light {
          filter: ${TILE_FILTERS.topo.light};
        }
        .map-layer--topo-dark {
          filter: ${TILE_FILTERS.topo.dark};
        }
        .map-labels--gold-light {
          filter: ${TILE_FILTERS.labels.light};
        }
        .map-labels--gold-dark {
          filter: ${TILE_FILTERS.labels.dark};
        }
        .map-layer--satellite-light img,
        .map-layer--satellite-dark img,
        .map-layer--topo-light img,
        .map-layer--topo-dark img,
        .map-labels--gold-light img,
        .map-labels--gold-dark img {
          filter: inherit;
          image-rendering: auto;
        }
        .map-layer--satellite-light img,
        .map-layer--satellite-dark img,
        .map-layer--topo-light img,
        .map-layer--topo-dark img {
          filter: inherit;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
        .leaflet-interactive {
          cursor: pointer !important;
        }
        .leaflet-overlay-pane svg path {
          pointer-events: auto;
        }
        @keyframes search-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.6); opacity: 0.3; }
        }
        .search-highlight-pulse {
          animation: search-pulse 1.5s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>
    </div>
  );
});
