import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api";
import { usePageVisibility } from "@/hooks/usePageVisibility";

interface RecentEvent {
  id: number;
  name: string;
  created_at: string;
  route?: string;
  tab?: string;
  latency_ms?: number;
  properties?: Record<string, any>;
}

interface DashboardData {
  // Existing
  applications_new_24h: number;
  p95_results_loaded_ms: number;
  outbox_pending: number;
  docs_pending: number;
  contracts_draft: number;
  slides_active: number;
  slider_last_update: string;
  bot_events_24h: number;
  price_observations_24h: number;
  tuition_consensus_stale_count: number;
  scholarships_draft: number;
  scholarships_published: number;
  
  // Visitors
  visitors_24h: number;
  visitors_7d: number;
  active_now_5m: number;
  pageviews_24h: number;
  
  // NEW: Bot latency metrics
  bot_avg_latency_ms: number;
  bot_p95_latency_ms: number;
  bot_responses_24h: number;
  
  // NEW: Registrations
  registrations_24h: number;
  registrations_7d: number;
  
  // NEW: Chat sessions
  chat_sessions_24h: number;
  chat_sessions_7d: number;
  
  // Top routes
  top_routes_24h?: Array<{ route: string; pageviews: number }>;
  
  // Recent events
  events_recent: RecentEvent[];
  
  // Queues
  queues: {
    outbox: any[];
    docs: any[];
    trans: any[];
  };
}

/**
 * Admin Dashboard hook with smart polling (P2 Optimization)
 * 
 * - Uses React Query for caching and smart refetching
 * - Pauses polling when page is hidden
 * - Refetches on window focus
 * - Realtime subscription for instant updates
 */
export function useAdminDashboard() {
  const isVisible = usePageVisibility();
  const queryClient = useQueryClient();

  const fetchDashboard = useCallback(async (): Promise<DashboardData | null> => {
    const response = await api("/admin-dashboard-summary", { timeout: 25000 });
    if (response?.ok && response?.summary) {
      return response.summary;
    }
    throw new Error("Failed to load dashboard data");
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: isVisible ? 30000 : false,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 15000,
    retry: 2,
    retryDelay: (attempt) => Math.min(5000 * 2 ** attempt, 20000),
    gcTime: 5 * 60 * 1000, // keep last good data for 5 min
  });

  // Realtime subscription for instant updates (no polling dependency)
  const invalidateQuery = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }, [queryClient]);

  // Subscribe to relevant table changes
  const subscribeToRealtime = useCallback(() => {
    const channel = supabase
      .channel('admin_dashboard_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, invalidateQuery)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'integration_outbox' }, invalidateQuery)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_documents' }, invalidateQuery)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, invalidateQuery)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invalidateQuery]);

  // Set up realtime on mount
  useQuery({
    queryKey: ["admin-dashboard-realtime"],
    queryFn: () => {
      subscribeToRealtime();
      return null;
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return { 
    data: data ?? null, 
    loading: isLoading, 
    error: error as Error | null, 
    reload: refetch 
  };
}
