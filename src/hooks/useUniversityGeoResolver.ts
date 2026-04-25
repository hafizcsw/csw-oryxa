/**
 * Hook: useUniversityGeoResolver
 * 
 * Resolves missing university coordinates via the geo-resolve edge function.
 * Results are persisted to both geo_cache and universities table (server-side),
 * so subsequent visitors get instant coordinates without re-resolving.
 */
import { useEffect, useRef, useState } from "react";
import {
  batchLookupGeoCache,
  resolveAndPersistCities,
  uniKey,
  type ResolvedLocation,
} from "@/lib/geoResolver";
import type { CityUniversity } from "@/hooks/useMapData";

interface UniGeoResult {
  resolved: Map<string, ResolvedLocation>;
  isResolving: boolean;
}

const BATCH_SIZE = 20;

export function useUniversityGeoResolver(
  universities: CityUniversity[] | undefined,
  countryCode: string | null,
  enabled = true
): UniGeoResult {
  const [resolved, setResolved] = useState<Map<string, ResolvedLocation>>(new Map());
  const [isResolving, setIsResolving] = useState(false);
  const attemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!universities || !countryCode || universities.length === 0 || !enabled) return;

    const missing = universities.filter(
      u => u.geo_lat == null || u.geo_lon == null
    );
    if (missing.length === 0) return;

    // Build keys and skip already attempted
    const newMissing = missing.filter(u => !attemptedRef.current.has(u.university_id));
    if (newMissing.length === 0) return;

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      setIsResolving(true);
      try {
        // Mark as attempted
        for (const u of newMissing) attemptedRef.current.add(u.university_id);

        // 1. Check geo_cache first
        const keys = newMissing.map(u => uniKey(u.university_id));
        const cached = await batchLookupGeoCache(keys);

        // Find still missing after cache check
        const stillMissing = newMissing.filter(u => !cached.has(uniKey(u.university_id)));

        // 2. Resolve via edge function in batches
        if (stillMissing.length > 0 && !cancelled) {
          for (let i = 0; i < stillMissing.length; i += BATCH_SIZE) {
            if (cancelled) break;
            const batch = stillMissing.slice(i, i + BATCH_SIZE);
            const entries = batch.map(u => ({
              city_name: u.city || 'unknown',
              country_code: countryCode,
              entity_type: 'university' as const,
              entity_id: u.university_id,
              university_name: u.university_name_en || u.university_name_ar,
            }));

            const newlyResolved = await resolveAndPersistCities(entries);
            for (const [k, v] of newlyResolved) {
              cached.set(k, v);
            }
          }
        }

        // Update state
        if (cached.size > 0 && !cancelled) {
          setResolved(prev => {
            const merged = new Map(prev);
            for (const [k, v] of cached) merged.set(k, v);
            return merged;
          });
        }
      } catch (e) {
        console.warn('[useUniversityGeoResolver] Error:', e);
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    };

    // Defer to idle so the map can paint and the user sees something fast.
    const ric: any = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 600));
    const cic: any = (window as any).cancelIdleCallback || clearTimeout;
    const handle = ric(() => { if (!cancelled) run(); }, { timeout: 2000 });
    return () => { cancelled = true; cic(handle); };
  }, [universities, countryCode, enabled]);

  return { resolved, isResolving };
}
