// ─── Decision Dashboard Types ───
// Single source of truth for all dashboard-related types

export type IdentityDomain = 'visitor_id' | 'user_id' | 'application_id';
export type CountSource = 'events' | 'profiles' | 'applications' | 'application_documents';

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
  truth_buckets?: TruthBuckets;
  analytics_truth_started_at?: string;
}

export interface TruthBucketEntry {
  visitors: number;
  pageviews: number;
}

export interface TruthBuckets {
  known_real?: TruthBucketEntry;
  unknown_legacy?: TruthBucketEntry;
  known_internal_or_test?: TruthBucketEntry;
  all_traffic?: TruthBucketEntry;
}

export interface FunnelStep {
  step: string;
  step_order: number;
  visitors: number;
  identity_domain: IdentityDomain;
  count_source?: CountSource;
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

/** Column definition for RankedTable */
export interface RankedColumn {
  key: string;
  label: string;
  mono?: boolean;
}

/** KPI period for KpiCard */
export interface KpiPeriod {
  label: string;
  value?: number;
}
