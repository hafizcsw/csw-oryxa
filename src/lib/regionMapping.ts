/**
 * City-to-Region mapping using point-in-polygon.
 * Maps cities (with lat/lon) to subdivision polygons from geodata.
 */

import type { CitySummary, CityUniversity } from "@/hooks/useMapData";

export interface RegionSummary {
  regionId: string;
  regionName: string;
  universities_count: number;
  programs_count: number;
  fee_min: number | null;
  fee_max: number | null;
  cities: string[];
}

/** Simple ray-casting point-in-polygon test */
function pointInPolygon(
  point: [number, number], // [lon, lat]
  polygon: number[][] // [[lon, lat], ...]
): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Test if a point is inside a GeoJSON geometry (Polygon or MultiPolygon) */
function pointInGeometry(
  point: [number, number],
  geometry: GeoJSON.Geometry
): boolean {
  if (geometry.type === "Polygon") {
    return pointInPolygon(point, geometry.coordinates[0]);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((poly) => pointInPolygon(point, poly[0]));
  }
  return false;
}

/**
 * Map cities to regions using point-in-polygon.
 * Returns a mapping of regionId → list of city names.
 */
export function mapCitiesToRegions(
  cities: CitySummary[],
  geodata: GeoJSON.FeatureCollection
): Record<string, string[]> {
  const regionMap: Record<string, string[]> = {};

  // Initialize all regions
  for (const feature of geodata.features) {
    const id = (feature as any).id || feature.properties?.id;
    if (id) regionMap[id] = [];
  }

  for (const city of cities) {
    if (city.city_lat == null || city.city_lon == null) continue;
    const point: [number, number] = [city.city_lon, city.city_lat];

    for (const feature of geodata.features) {
      const id = (feature as any).id || feature.properties?.id;
      if (!id || !feature.geometry) continue;
      if (pointInGeometry(point, feature.geometry)) {
        regionMap[id] = regionMap[id] || [];
        regionMap[id].push(city.city);
        break;
      }
    }
  }

  return regionMap;
}

/**
 * Build region summaries by aggregating city data per region.
 */
export function buildRegionSummaries(
  cities: CitySummary[],
  geodata: GeoJSON.FeatureCollection,
  cityToRegion: Record<string, string[]>
): RegionSummary[] {
  const cityDataMap = new Map<string, CitySummary>();
  for (const c of cities) {
    if (c.city) cityDataMap.set(c.city, c);
  }

  const summaries: RegionSummary[] = [];

  for (const feature of geodata.features) {
    const id = (feature as any).id || feature.properties?.id;
    const name = feature.properties?.name || id;
    if (!id) continue;

    const regionCities = cityToRegion[id] || [];
    if (regionCities.length === 0) continue;

    let totalUnis = 0;
    let totalPrograms = 0;
    let feeMin: number | null = null;
    let feeMax: number | null = null;

    for (const cityName of regionCities) {
      const cd = cityDataMap.get(cityName);
      if (!cd) continue;
      totalUnis += cd.universities_count;
      totalPrograms += cd.programs_count;
      if (cd.fee_min != null) {
        feeMin = feeMin == null ? cd.fee_min : Math.min(feeMin, cd.fee_min);
      }
      if (cd.fee_max != null) {
        feeMax = feeMax == null ? cd.fee_max : Math.max(feeMax, cd.fee_max);
      }
    }

    summaries.push({
      regionId: id,
      regionName: name,
      universities_count: totalUnis,
      programs_count: totalPrograms,
      fee_min: feeMin,
      fee_max: feeMax,
      cities: regionCities,
    });
  }

  return summaries.sort((a, b) => b.universities_count - a.universities_count);
}

/**
 * Filter universities to those in a specific region's cities.
 */
export function filterUniversitiesByRegion(
  universities: CityUniversity[],
  regionCities: string[]
): CityUniversity[] {
  const citySet = new Set(regionCities.map((c) => c.toLowerCase()));
  return universities.filter(
    (u) => u.city && citySet.has(u.city.toLowerCase())
  );
}

/**
 * Get all cities that couldn't be mapped to any region.
 */
export function getUnmappedCities(
  cities: CitySummary[],
  cityToRegion: Record<string, string[]>
): CitySummary[] {
  const mappedCities = new Set(
    Object.values(cityToRegion).flat().map((c) => c.toLowerCase())
  );
  return cities.filter(
    (c) => c.city && !mappedCities.has(c.city.toLowerCase())
  );
}
