import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CountryWithStats {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string | null;
  country_code: string;
  image_url: string | null;
  education_rank_global: number | null;
  international_students: number | null;
  universities_count: number;
  programs_count: number;
  ranked_universities_count: number;
}

interface CountryStats {
  country_id: string;
  universities_count: number;
  programs_count: number;
  ranked_universities_count: number;
}

export function useCountriesWithStats() {
  return useQuery({
    queryKey: ["countries-with-stats"],
    queryFn: async (): Promise<CountryWithStats[]> => {
      // Fetch countries
      const { data: countries, error: countriesError } = await supabase
        .from("countries")
        .select("id, slug, name_ar, name_en, country_code, image_url, education_rank_global, international_students")
        .order("display_order", { ascending: true });

      if (countriesError) throw countriesError;
      if (!countries || countries.length === 0) return [];

      // Use RPC function to get aggregated stats (avoids 1000 row limit)
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_countries_with_stats');

      if (statsError) throw statsError;

      // Build stats lookup map
      const statsMap: Record<string, CountryStats> = {};
      (statsData as CountryStats[] || []).forEach(stat => {
        statsMap[stat.country_id] = stat;
      });

      // Merge countries with stats
      return countries.map(country => ({
        ...country,
        universities_count: statsMap[country.id]?.universities_count || 0,
        programs_count: statsMap[country.id]?.programs_count || 0,
        ranked_universities_count: statsMap[country.id]?.ranked_universities_count || 0,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
