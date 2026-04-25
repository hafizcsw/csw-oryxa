/**
 * Hook: useGeoCacheResolver
 * 
 * Automatically resolves missing city coordinates via the geo-resolve
 * edge function and persists results to the backend geo_cache.
 * 
 * Pattern: cache-miss → resolve via Nominatim → persist → reuse
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  batchLookupGeoCache,
  resolveAndPersistCities,
  cityKey,
  type ResolvedLocation,
} from "@/lib/geoResolver";
import type { CitySummary } from "@/hooks/useMapData";

interface GeoCacheResult {
  /** Resolved locations keyed by normalized_query_key */
  resolved: Map<string, ResolvedLocation>;
  /** Whether resolution is still in progress */
  isResolving: boolean;
}

export function useGeoCacheResolver(
  citySummaries: CitySummary[] | undefined,
  countryCode: string | null
): GeoCacheResult {
  const [resolved, setResolved] = useState<Map<string, ResolvedLocation>>(new Map());
  const [isResolving, setIsResolving] = useState(false);
  const resolvedRef = useRef<Set<string>>(new Set()); // track what we've already tried

  useEffect(() => {
    if (!citySummaries || !countryCode || citySummaries.length === 0) return;

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      // 1. Find cities missing coordinates
      const missingCities = citySummaries.filter(
        c => c.city && c.city !== '__unknown__' && (c.city_lat == null || c.city_lon == null)
      );

      if (missingCities.length === 0) return;

      // Build cache keys
      const keys = missingCities.map(c => cityKey(countryCode, c.city));
      
      // Skip already-attempted keys
      const newKeys = keys.filter(k => !resolvedRef.current.has(k));
      if (newKeys.length === 0) return;

      setIsResolving(true);

      try {
        // 2. Check backend cache first
        const cached = await batchLookupGeoCache(newKeys);
        
        // Mark checked keys
        for (const key of newKeys) {
          resolvedRef.current.add(key);
        }

        // Find still-missing
        const stillMissing = missingCities.filter(c => {
          const key = cityKey(countryCode, c.city);
          return !cached.has(key);
        });

        // 3. Resolve missing via edge function (Nominatim)
        if (stillMissing.length > 0) {
          const entries = stillMissing.map(c => ({
            city_name: c.city,
            country_code: countryCode,
          }));

          const newlyResolved = await resolveAndPersistCities(entries);
          
          // Merge
          for (const [k, v] of newlyResolved) {
            cached.set(k, v);
          }
        }

        // Update state
        setResolved(prev => {
          const merged = new Map(prev);
          for (const [k, v] of cached) {
            merged.set(k, v);
          }
          return merged;
        });
      } catch (e) {
        console.warn('[useGeoCacheResolver] Error:', e);
      } finally {
        setIsResolving(false);
      }
    };

    // Defer to idle so the map can paint first.
    const ric: any = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 400));
    const cic: any = (window as any).cancelIdleCallback || clearTimeout;
    const handle = ric(() => { if (!cancelled) run(); }, { timeout: 1500 });
    return () => { cancelled = true; cic(handle); };
  }, [citySummaries, countryCode]);

  return { resolved, isResolving };
}
