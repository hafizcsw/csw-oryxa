/**
 * useOsmCityOverlay — fetches OSM-verified positions for universities in a city.
 * Returns a Map<university_id, OsmOverlayMatch> for the map renderer.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CityUniversity } from "./useMapData";

export interface OsmOverlayMatch {
  university_id: string;
  lat: number | null;
  lon: number | null;
  osm_type: string | null;
  osm_id: string | null;
  matched_name: string | null;
  match_confidence: number | null;
  match_status: "matched" | "ambiguous" | "unmatched" | "rejected";
}

export function useOsmCityOverlay(
  cityName: string | null,
  countryCode: string | null,
  cityLat: number | null,
  cityLon: number | null,
  universities: CityUniversity[],
  enabled: boolean
) {
  return useQuery({
    queryKey: ["osm-city-overlay", cityName, countryCode],
    queryFn: async (): Promise<Map<string, OsmOverlayMatch>> => {
      if (
        !cityName ||
        !countryCode ||
        cityLat == null ||
        cityLon == null ||
        universities.length === 0
      ) {
        return new Map();
      }

      const { data, error } = await supabase.functions.invoke(
        "osm-city-university-overlay",
        {
          body: {
            city_name: cityName,
            country_code: countryCode,
            city_lat: cityLat,
            city_lon: cityLon,
            universities: universities.map((u) => ({
              id: u.university_id,
              name_en: u.university_name_en,
              name_ar: u.university_name_ar,
            })),
          },
        }
      );

      if (error) throw error;

      const map = new Map<string, OsmOverlayMatch>();
      for (const match of data?.universities || []) {
        map.set(match.university_id, match as OsmOverlayMatch);
      }
      return map;
    },
    enabled:
      enabled &&
      !!cityName &&
      !!countryCode &&
      cityLat != null &&
      cityLon != null &&
      universities.length > 0,
    staleTime: 10 * 60_000, // 10 min client-side
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
