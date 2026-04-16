/**
 * ============================================================
 * MAP DATA HOOK — Server-side aggregation from vw_program_search_api_v3_final
 * ============================================================
 *
 * All levels (country/city/region/university) use the same SoT view
 * with the same filter contract (degree_slug, fees_max).
 *
 * Count semantics (locked):
 * - universities_count = COUNT(DISTINCT university_id)
 * - programs_count = COUNT(DISTINCT program_id)
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MapRpcParams } from "./useMapFilters";

const PALESTINE_CANONICAL_CODE = "PS";
const PALESTINE_LEGACY_ALIAS = "IL";

function normalizeMapCountryCode(countryCode: string | null | undefined): string | null {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return null;
  return code === PALESTINE_LEGACY_ALIAS ? PALESTINE_CANONICAL_CODE : code;
}

function mergeCountrySummaries(
  existing: CountrySummary | undefined,
  incoming: CountrySummary,
): CountrySummary {
  if (!existing) return incoming;

  return {
    ...incoming,
    universities_count: existing.universities_count + incoming.universities_count,
    programs_count: existing.programs_count + incoming.programs_count,
    fee_min:
      existing.fee_min == null
        ? incoming.fee_min
        : incoming.fee_min == null
          ? existing.fee_min
          : Math.min(existing.fee_min, incoming.fee_min),
    fee_max:
      existing.fee_max == null
        ? incoming.fee_max
        : incoming.fee_max == null
          ? existing.fee_max
          : Math.max(existing.fee_max, incoming.fee_max),
  };
}

export interface CountrySummary {
  country_code: string;
  country_name_ar: string;
  country_name_en: string;
  universities_count: number;
  programs_count: number;
  fee_min: number | null;
  fee_max: number | null;
}

export interface CitySummary {
  city: string;
  universities_count: number;
  programs_count: number;
  fee_min: number | null;
  fee_max: number | null;
  city_lat: number | null;
  city_lon: number | null;
}

export interface CityUniversity {
  university_id: string;
  university_name_ar: string;
  university_name_en: string;
  university_logo: string | null;
  city: string;
  programs_count: number;
  fee_min: number | null;
  fee_max: number | null;
  geo_lat: number | null;
  geo_lon: number | null;
  geo_source: string | null;
  has_dorm: boolean;
  dorm_lat: number | null;
  dorm_lon: number | null;
  dorm_address: string | null;
  dorm_price_monthly_local: number | null;
  dorm_currency_code: string | null;
}

export function useMapCountrySummary(rpcParams: MapRpcParams) {
  return useQuery({
    queryKey: ["map-country-summary", rpcParams.p_degree_slug, rpcParams.p_fees_max],
    queryFn: async (): Promise<Record<string, CountrySummary>> => {
      const { data, error } = await supabase.rpc("rpc_map_country_summary", {
        p_degree_slug: rpcParams.p_degree_slug,
        p_fees_max: rpcParams.p_fees_max,
      });
      if (error) throw error;

      const map: Record<string, CountrySummary> = {};
      (data as CountrySummary[] || []).forEach((row) => {
        const code = normalizeMapCountryCode(row.country_code);
        if (!code) return;

        const normalizedRow: CountrySummary = {
          ...row,
          country_code: code,
          country_name_ar: code === PALESTINE_CANONICAL_CODE ? "فلسطين" : row.country_name_ar,
          country_name_en: code === PALESTINE_CANONICAL_CODE ? "Palestine" : row.country_name_en,
          universities_count: Number(row.universities_count || 0),
          programs_count: Number(row.programs_count || 0),
          fee_min: row.fee_min ?? null,
          fee_max: row.fee_max ?? null,
        };

        map[code] = mergeCountrySummaries(map[code], normalizedRow);
      });

      return map;
    },
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}

export function useMapCitySummary(countryCode: string | null, rpcParams: MapRpcParams) {
  const canonicalCountryCode = normalizeMapCountryCode(countryCode);

  return useQuery({
    queryKey: ["map-city-summary", canonicalCountryCode, rpcParams.p_degree_slug, rpcParams.p_fees_max],
    queryFn: async (): Promise<CitySummary[]> => {
      console.log("[Map] Fetching city summary for", canonicalCountryCode);
      const { data, error } = await supabase.rpc("rpc_map_city_summary", {
        p_country_code: canonicalCountryCode!,
        p_degree_slug: rpcParams.p_degree_slug,
        p_fees_max: rpcParams.p_fees_max,
      });
      if (error) {
        console.error("[Map] rpc_map_city_summary error:", error);
        return [];
      }
      console.log("[Map] City summary loaded:", (data as CitySummary[])?.length || 0, "cities");
      return (data as CitySummary[]) || [];
    },
    enabled: !!canonicalCountryCode,
    retry: 0,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}

export function useMapCityUniversities(
  countryCode: string | null,
  city: string | null,
  rpcParams: MapRpcParams
) {
  const canonicalCountryCode = normalizeMapCountryCode(countryCode);

  return useQuery({
    queryKey: ["map-city-universities", canonicalCountryCode, city, rpcParams.p_degree_slug, rpcParams.p_fees_max],
    queryFn: async (): Promise<CityUniversity[]> => {
      const { data, error } = await supabase.rpc("rpc_map_city_universities", {
        p_country_code: canonicalCountryCode!,
        p_city: city!,
        p_degree_slug: rpcParams.p_degree_slug,
        p_fees_max: rpcParams.p_fees_max,
      });
      if (error) throw error;
      return (data as CityUniversity[]) || [];
    },
    enabled: !!canonicalCountryCode && !!city,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}

/** Fetch ALL universities in a country (for region-level client-side filtering) */
export function useMapCountryUniversities(
  countryCode: string | null,
  rpcParams: MapRpcParams,
  enabled = true
) {
  const canonicalCountryCode = normalizeMapCountryCode(countryCode);

  return useQuery({
    queryKey: ["map-country-universities", canonicalCountryCode, rpcParams.p_degree_slug, rpcParams.p_fees_max],
    queryFn: async (): Promise<CityUniversity[]> => {
      console.log("[Map] Fetching country universities for", canonicalCountryCode);
      const { data, error } = await supabase.rpc("rpc_map_country_universities", {
        p_country_code: canonicalCountryCode!,
        p_degree_slug: rpcParams.p_degree_slug,
        p_fees_max: rpcParams.p_fees_max,
      });
      if (error) {
        console.error("[Map] rpc_map_country_universities error:", error);
        throw error;
      }
      console.log("[Map] Country universities loaded:", (data as CityUniversity[])?.length || 0);
      return (data as CityUniversity[]) || [];
    },
    enabled: !!canonicalCountryCode && enabled,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}
