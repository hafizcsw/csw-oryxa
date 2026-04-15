import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface ScholarshipSearchFilters {
  country_code?: string | null;
  degree_slug?: string | null;
  amount_type?: string | null;
  coverage_type?: string | null;
  amount_min?: number | null;
  limit?: number;
  offset?: number;
}

export interface ScholarshipSearchResult {
  scholarship_id: string;
  title: string;
  description: string | null;
  status: string;
  is_active: boolean;
  university_id: string | null;
  university_name: string | null;
  university_logo: string | null;
  country_id: string | null;
  country_code: string | null;
  country_name_ar: string | null;
  country_name_en: string | null;
  country_slug: string | null;
  degree_id: string | null;
  degree_slug: string | null;
  degree_name: string | null;
  study_level: string | null;
  amount_type: string | null;
  amount_value: number | null;
  percent_value: number | null;
  currency_code: string | null;
  coverage_type: string | null;
  deadline: string | null;
  link: string | null;
  eligibility: string[] | null;
  image_url: string | null;
}

export interface ScholarshipSearchResponse {
  ok: boolean;
  items: ScholarshipSearchResult[];
  count: number;
  error?: string;
}

export function useScholarshipSearch(filters: ScholarshipSearchFilters = {}) {
  // Stable query key
  const queryKey = useMemo(() => {
    return [
      "scholarship-search",
      filters.country_code ?? null,
      filters.degree_slug ?? null,
      filters.amount_type ?? null,
      filters.coverage_type ?? null,
      filters.amount_min ?? null,
      filters.limit ?? 20,
      filters.offset ?? 0,
    ];
  }, [
    filters.country_code,
    filters.degree_slug,
    filters.amount_type,
    filters.coverage_type,
    filters.amount_min,
    filters.limit,
    filters.offset,
  ]);

  return useQuery<ScholarshipSearchResponse>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("search-scholarships", {
        body: {
          country_code: filters.country_code || null,
          degree_slug: filters.degree_slug || null,
          amount_type: filters.amount_type || null,
          coverage_type: filters.coverage_type || null,
          amount_min: filters.amount_min || null,
          limit: filters.limit ?? 20,
          offset: filters.offset ?? 0,
        },
      });

      if (error) {
        console.error("[useScholarshipSearch] Edge error:", error);
        throw error;
      }

      return data as ScholarshipSearchResponse;
    },
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
  });
}

// Format scholarship amount for display
export function formatScholarshipAmount(
  amountType: string | null,
  amountValue: number | null,
  percentValue: number | null,
  currencyCode: string | null
): string {
  if (amountType === "full") {
    return "منحة كاملة";
  }
  
  if (amountType === "percent" && percentValue) {
    return `${percentValue}%`;
  }
  
  if (amountType === "fixed" && amountValue) {
    return `${amountValue.toLocaleString()} ${currencyCode || "USD"}`;
  }
  
  // Fallback for legacy data
  if (amountValue) {
    return `${amountValue.toLocaleString()} ${currencyCode || "USD"}`;
  }
  
  return "—";
}
