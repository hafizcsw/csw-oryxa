import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseVirtualUniversitiesOptions {
  pageSize?: number;
  searchQuery?: string;
}

interface University {
  id: string;
  name: string;
}

/**
 * Hook for paginated university loading with virtual scrolling support
 * Loads universities in batches and caches results
 */
export function useVirtualUniversities(options: UseVirtualUniversitiesOptions = {}) {
  const { pageSize = 100, searchQuery = "" } = options;
  
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const cacheRef = useRef<University[]>([]);
  const offsetRef = useRef(0);
  const searchQueryRef = useRef(searchQuery);
  const loadingRef = useRef(false);

  // Reset cache when search query changes
  useEffect(() => {
    if (searchQuery !== searchQueryRef.current) {
      searchQueryRef.current = searchQuery;
      cacheRef.current = [];
      offsetRef.current = 0;
      setUniversities([]);
      setHasMore(true);
      setError(null);
    }
  }, [searchQuery]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("universities")
        .select("id,name", { count: "exact" })
        .order("name")
        .range(offsetRef.current, offsetRef.current + pageSize - 1);

      // Add search filter if provided
      if (searchQuery.trim()) {
        const s = searchQuery.trim().toLowerCase();
        query = query.or(`name.ilike.%${s}%`);
      }

      const { data, count, error: queryError } = await query;

      if (queryError) {
        setError(queryError.message);
        return;
      }

      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }

      // Update cache and state
      cacheRef.current = [...cacheRef.current, ...(data || [])];
      setUniversities(cacheRef.current);
      offsetRef.current += data.length;

      // Check if there are more results
      if (data.length < pageSize || (count && offsetRef.current >= count)) {
        setHasMore(false);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [pageSize, searchQuery, hasMore]);

  // Auto-load first page on mount
  useEffect(() => {
    if (cacheRef.current.length === 0 && !loadingRef.current) {
      loadMore();
    }
  }, [loadMore]);

  const reset = useCallback(() => {
    cacheRef.current = [];
    offsetRef.current = 0;
    setUniversities([]);
    setHasMore(true);
    setError(null);
    setLoading(false);
    loadingRef.current = false;
  }, []);

  return {
    universities,
    loading,
    hasMore,
    error,
    loadMore,
    reset,
    total: universities.length,
  };
}
