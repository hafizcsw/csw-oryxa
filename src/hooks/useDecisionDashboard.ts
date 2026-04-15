import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePageVisibility } from "@/hooks/usePageVisibility";

export interface OverviewData {
  visitors_24h: number;
  visitors_7d: number;
  visitors_30d: number;
  active_now: number;
  pageviews_24h: number;
  pageviews_7d: number;
  pageviews_30d: number;
  registrations_24h: number;
  registrations_7d: number;
  registrations_30d: number;
  shortlist_adds_24h: number;
  shortlist_adds_7d: number;
  shortlist_adds_30d: number;
  application_starts_24h: number;
  application_starts_7d: number;
  doc_uploads_24h: number;
  chat_sessions_24h: number;
  chat_sessions_7d: number;
  returning_visitors_pct: number;
  avg_engaged_time_sec: number;
  engaged_time_source: 'heartbeat' | 'session_estimate';
  daily_trend: Array<{ day: string; visitors: number; pageviews: number }>;
}

export interface FunnelStep {
  step: string;
  step_order: number;
  visitors: number;
  identity_domain: 'visitor_id' | 'user_id' | 'application_id';
  count_source?: 'events' | 'profiles' | 'applications' | 'application_documents';
}

export interface FunnelGroup {
  name: string;
  steps: FunnelStep[];
}

export interface EngagementData {
  top_pages_by_views: Array<{ page_route: string; views: number; unique_visitors: number }>;
  top_exit_pages: Array<{ page_route: string; exit_count: number }>;
  device_breakdown: Array<{ device: string; visitors: number }>;
  hourly_pattern: Array<{ hr: number; visitors: number }>;
  bounce_rate: number;
  bounce_basis: string;
}

export interface UniversityIntelData {
  top_by_views: Array<{ name_ar: string; name_en: string; slug: string; views: number; unique_visitors: number }>;
  top_by_shortlist: Array<{ name_ar: string; name_en: string; slug: string; entity_id: string; adds: number; unique_users: number }>;
  top_programs_by_views: Array<{ program_title: string; university_name: string; prog_slug: string; views: number; unique_visitors: number }>;
  data_source: 'entity_view_events' | 'route_parsing_fallback' | 'blended_entity_and_route';
}

export interface SearchIntelData {
  top_country_filters: Array<{ filter_val: string; uses: number; unique_users: number }>;
  top_degree_filters: Array<{ filter_val: string; uses: number }>;
  search_to_click_pct: number;
  search_to_shortlist_pct: number;
  total_searches_30d: number;
  attribution_method: string;
}

export interface ContentGapsData {
  universities_missing_tuition: Array<{ name_ar: string; slug: string; views: number }>;
  programs_missing_deadlines: Array<{ title: string; uni_name: string; uni_slug: string; views: number }>;
  high_traffic_incomplete: Array<{ name_ar: string; slug: string; views: number; published_programs: number; with_tuition: number }>;
}

export interface DecisionDashboardData {
  overview: OverviewData;
  funnel: FunnelStep[];
  funnels?: FunnelGroup[];
  engagement: EngagementData;
  university_intel: UniversityIntelData;
  search_intel: SearchIntelData;
  content_gaps: ContentGapsData;
  generated_at: string;
}

export function useDecisionDashboard() {
  const isVisible = usePageVisibility();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["decision-dashboard"],
    queryFn: async (): Promise<DecisionDashboardData | null> => {
      const res = await api("/decision-analytics", { timeout: 30000 });
      if (res?.ok && res?.data) return res.data;
      throw new Error(res?.error || "Failed to load analytics");
    },
    refetchInterval: isVisible ? 60000 : false,
    refetchOnWindowFocus: true,
    staleTime: 30000,
    retry: 2,
    gcTime: 5 * 60 * 1000,
  });

  return {
    data: data ?? null,
    loading: isLoading,
    error: error as Error | null,
    reload: refetch,
  };
}
