import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePageVisibility } from "@/hooks/usePageVisibility";

interface RealtimeVisitorData {
  activeNow: number;
  recentPageviews: number;
}

/**
 * Realtime Visitors Hook (P2 Optimization)
 * 
 * - Uses React Query for smart caching
 * - Pauses polling when page is hidden
 * - Refetches on window focus
 * - Realtime subscription for instant updates
 */
export function useRealtimeVisitors() {
  const isVisible = usePageVisibility();
  const queryClient = useQueryClient();

  const fetchVisitorData = useCallback(async (): Promise<RealtimeVisitorData> => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: events, error } = await supabase
      .from("events")
      .select("visitor_id, created_at")
      .eq("name", "page_view")
      .gte("created_at", fiveMinutesAgo);

    if (error) throw error;

    if (events) {
      const uniqueVisitors = new Set(events.map(e => e.visitor_id)).size;
      return {
        activeNow: uniqueVisitors,
        recentPageviews: events.length,
      };
    }

    return { activeNow: 0, recentPageviews: 0 };
  }, []);

  const { data } = useQuery({
    queryKey: ["realtime-visitors"],
    queryFn: fetchVisitorData,
    // P2: Smart polling - only when visible
    refetchInterval: isVisible ? 15000 : false,
    refetchOnWindowFocus: true,
    staleTime: 10000,
    initialData: { activeNow: 0, recentPageviews: 0 },
  });

  // Realtime subscription for instant updates
  const invalidateQuery = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["realtime-visitors"] });
  }, [queryClient]);

  // Subscribe to page_view events
  useQuery({
    queryKey: ["realtime-visitors-subscription"],
    queryFn: () => {
      const channel = supabase
        .channel("visitor-tracking")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "events",
            filter: "name=eq.page_view",
          },
          invalidateQuery
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return data;
}
