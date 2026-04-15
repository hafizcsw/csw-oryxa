/**
 * ============================================================
 * Unified Geo Resolution Layer
 * ============================================================
 *
 * Single source of truth for resolving map coordinates across
 * all map surfaces (country, city, university, search).
 *
 * Resolution hierarchy (non-negotiable):
 * 1. OSM-verified coordinates (match_status === 'matched')
 * 2. Stored university geo_lat/geo_lon (from DB, with geo_source)
 * 3. City center fallback (from city_coordinates table / geo_cache)
 * 4. Unresolved — explicit state, never silent wrong placement
 *
 * Persistent cache:
 * - Backend: geo_cache table (primary source of truth)
 * - Frontend: in-memory LRU for session performance
 * - Edge function: geo-resolve for Nominatim resolve-once-persist-reuse
 */

import type { OsmOverlayMatch } from "@/hooks/useOsmCityOverlay";
import { supabase } from "@/integrations/supabase/client";

export type ResolutionLevel =
  | "university_verified"  // OSM-verified position
  | "university_stored"    // DB geo_lat/lon present
  | "city_resolved"        // Fell back to city center
  | "poi_exact"            // Exact point of interest (dorm, campus, etc.)
  | "unresolved";          // No coordinates available

export interface ResolvedLocation {
  lat: number;
  lon: number;
  source: string;
  confidence: number; // 0-1
  resolution_level: ResolutionLevel;
  label?: string; // normalized place name
  entity_type?: string;
  entity_id?: string;
  bbox?: { south: number; north: number; west: number; east: number } | null;
}

export interface GeoResolvableUniversity {
  university_id: string;
  geo_lat: number | null;
  geo_lon: number | null;
  geo_source?: string | null;
  city?: string | null;
}

export interface CityCoordinate {
  city: string;
  city_lat: number | null;
  city_lon: number | null;
}

/* ── In-memory session cache (secondary) ── */
const memoryCache = new Map<string, ResolvedLocation>();
const MEMORY_CACHE_MAX = 500;

function memoryCacheSet(key: string, val: ResolvedLocation) {
  if (memoryCache.size >= MEMORY_CACHE_MAX) {
    // Evict oldest entry
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, val);
}

function memoryCacheGet(key: string): ResolvedLocation | undefined {
  return memoryCache.get(key);
}

/**
 * Build normalized cache key for a city
 */
export function cityKey(countryCode: string, cityName: string): string {
  return `${countryCode.toLowerCase()}:${cityName.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

/**
 * Build normalized cache key for a university
 */
export function uniKey(universityId: string): string {
  return `uni:${universityId}`;
}

/**
 * Batch lookup from backend geo_cache.
 * Returns a map of key -> ResolvedLocation
 */
export async function batchLookupGeoCache(
  keys: string[]
): Promise<Map<string, ResolvedLocation>> {
  const result = new Map<string, ResolvedLocation>();
  if (keys.length === 0) return result;

  // Check memory cache first
  const missingKeys: string[] = [];
  for (const key of keys) {
    const cached = memoryCacheGet(key);
    if (cached) {
      result.set(key, cached);
    } else {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length === 0) return result;

  // Fetch from backend
  try {
    const { data, error } = await supabase.rpc('rpc_geo_cache_lookup', {
      p_keys: missingKeys,
    });

    if (!error && data) {
      for (const row of data as any[]) {
        if (row.resolution_level === 'unresolved' || (row.lat === 0 && row.lon === 0)) continue;
        const resolved: ResolvedLocation = {
          lat: row.lat,
          lon: row.lon,
          source: row.source,
          confidence: row.confidence,
          resolution_level: row.resolution_level as ResolutionLevel,
          label: row.city_name || undefined,
          entity_type: row.entity_type,
          entity_id: row.entity_id || undefined,
          bbox: row.bbox || null,
        };
        result.set(row.normalized_query_key, resolved);
        memoryCacheSet(row.normalized_query_key, resolved);
      }
    }
  } catch (e) {
    console.warn('[geoResolver] Backend cache lookup failed:', e);
  }

  return result;
}

/**
 * Request resolution for missing cities via the geo-resolve edge function.
 * This will resolve via Nominatim and persist to geo_cache.
 */
export async function resolveAndPersistCities(
  entries: Array<{ city_name: string; country_code: string; country_name?: string }>
): Promise<Map<string, ResolvedLocation>> {
  const result = new Map<string, ResolvedLocation>();
  if (entries.length === 0) return result;

  try {
    const { data, error } = await supabase.functions.invoke('geo-resolve', {
      body: { mode: 'resolve', entries },
    });

    if (!error && data?.results) {
      for (const r of data.results) {
        if (r.resolution_level === 'unresolved' || (r.lat === 0 && r.lon === 0)) continue;
        const resolved: ResolvedLocation = {
          lat: r.lat,
          lon: r.lon,
          source: r.source,
          confidence: r.confidence,
          resolution_level: r.resolution_level as ResolutionLevel,
          label: r.city_name || undefined,
          entity_type: r.entity_type,
          entity_id: r.entity_id || undefined,
          bbox: r.bbox || null,
        };
        result.set(r.key, resolved);
        memoryCacheSet(r.key, resolved);
      }
    }
  } catch (e) {
    console.warn('[geoResolver] resolve-and-persist failed:', e);
  }

  return result;
}

/**
 * Resolve a university's map position using the accepted hierarchy.
 */
export function resolveUniversityLocation(
  uni: GeoResolvableUniversity,
  osmOverlay?: Map<string, OsmOverlayMatch>,
  cityCoords?: Map<string, [number, number]>
): ResolvedLocation | null {
  // Priority 1: OSM-verified position
  if (osmOverlay && osmOverlay.size > 0) {
    const match = osmOverlay.get(uni.university_id);
    if (match && match.match_status === "matched" && match.lat != null && match.lon != null) {
      return {
        lat: match.lat,
        lon: match.lon,
        source: `osm_verified:${match.osm_type || ""}:${match.osm_id || ""}`,
        confidence: match.match_confidence ?? 0.9,
        resolution_level: "university_verified",
        label: match.matched_name ?? undefined,
        entity_type: "university",
        entity_id: uni.university_id,
      };
    }
  }

  // Priority 2: Stored university coordinates
  if (uni.geo_lat != null && uni.geo_lon != null) {
    const source = uni.geo_source || "database";
    const isVerifiedSource = source.toLowerCase().includes("verified") ||
      source.toLowerCase().includes("osm") ||
      source.toLowerCase().includes("google");
    return {
      lat: uni.geo_lat,
      lon: uni.geo_lon,
      source,
      confidence: isVerifiedSource ? 0.85 : 0.6,
      resolution_level: "university_stored",
      entity_type: "university",
      entity_id: uni.university_id,
    };
  }

  // Priority 3: City center fallback
  if (uni.city && cityCoords) {
    const coords = cityCoords.get(uni.city.toLowerCase());
    if (coords) {
      return {
        lat: coords[0],
        lon: coords[1],
        source: "city_center_fallback",
        confidence: 0.3,
        resolution_level: "city_resolved",
        label: uni.city,
        entity_type: "university",
        entity_id: uni.university_id,
      };
    }
  }

  // Priority 4: Unresolved
  return null;
}

/**
 * Resolve a city's map position.
 */
export function resolveCityLocation(city: CityCoordinate): ResolvedLocation | null {
  if (city.city_lat != null && city.city_lon != null) {
    return {
      lat: city.city_lat,
      lon: city.city_lon,
      source: "city_coordinates",
      confidence: 0.8,
      resolution_level: "city_resolved",
      label: city.city,
      entity_type: "city",
    };
  }
  return null;
}

/**
 * Build a city coordinate lookup map from city summaries.
 */
export function buildCityCoordsMap(
  citySummaries: CityCoordinate[]
): Map<string, [number, number]> {
  const map = new Map<string, [number, number]>();
  for (const c of citySummaries) {
    if (c.city && c.city_lat != null && c.city_lon != null) {
      map.set(c.city.toLowerCase(), [c.city_lat, c.city_lon]);
    }
  }
  return map;
}

/**
 * Check if a resolution is a city-center fallback (not exact campus location).
 */
export function isCityFallback(resolved: ResolvedLocation | null): boolean {
  return resolved?.resolution_level === "city_resolved";
}

/**
 * Check if a resolution is verified (OSM or verified source).
 */
export function isVerified(resolved: ResolvedLocation | null): boolean {
  return resolved?.resolution_level === "university_verified";
}

/**
 * Resolve a dormitory / housing point.
 */
export function resolveDormLocation(
  uni: { dorm_lat: number | null; dorm_lon: number | null; dorm_address: string | null }
): ResolvedLocation | null {
  if (uni.dorm_lat != null && uni.dorm_lon != null) {
    return {
      lat: uni.dorm_lat,
      lon: uni.dorm_lon,
      source: "database_dorm",
      confidence: 0.8,
      resolution_level: "poi_exact",
      label: uni.dorm_address || undefined,
      entity_type: "dorm",
    };
  }
  return null;
}
