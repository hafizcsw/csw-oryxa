import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { searchPrograms } from "@/lib/portalApi";

export function useProgramSearch(filters: Record<string, any>, enabled = true) {
  // Stable queryKey based on raw filters (normalization now happens in API layer)
  const queryKey = useMemo(() => 
    ["program-search", JSON.stringify(filters)], 
    [filters]
  );

  return useQuery({
    queryKey,
    queryFn: async () => {
      console.log('[useProgramSearch] Fetching with filters:', filters);
      const res = await searchPrograms(filters);
      if (res?.ok === false) {
        console.warn('[useProgramSearch] Search failed:', res.error_code || res.error);
        return { items: [], total: 0, has_next: false, next_offset: 0, error_code: res.error_code };
      }
      return { 
        items: res.items ?? [], 
        total: res.total ?? null,
        has_next: res.has_next ?? false,
        next_offset: res.next_offset ?? 0,
        error_code: null
      };
    },
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}
