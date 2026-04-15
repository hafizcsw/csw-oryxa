// ─── Dashboard Contract ───
// Front-end source of truth for section structure, ordering, and i18n keys.

export type DashboardSectionKey = 'overview' | 'funnel' | 'engagement' | 'universities' | 'search' | 'gaps';

export interface DashboardSectionDef {
  key: DashboardSectionKey;
  order: number;
  titleKey: string;            // i18n key
  dataKey: keyof DashboardDataKeys;
  icon: string;                // lucide icon name
  enabled: boolean;
}

/** Maps section keys to the data fields they consume */
export interface DashboardDataKeys {
  overview: 'overview';
  funnel: 'funnel';
  engagement: 'engagement';
  universities: 'university_intel';
  search: 'search_intel';
  gaps: 'content_gaps';
}

export const DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  { key: 'overview',      order: 1, titleKey: 'dashboard.tabs.overview',      dataKey: 'overview',      icon: 'bar-chart-3',     enabled: true },
  { key: 'funnel',        order: 2, titleKey: 'dashboard.tabs.funnel',        dataKey: 'funnel',        icon: 'filter',          enabled: true },
  { key: 'engagement',    order: 3, titleKey: 'dashboard.tabs.engagement',    dataKey: 'engagement',    icon: 'target',          enabled: true },
  { key: 'universities',  order: 4, titleKey: 'dashboard.tabs.universities',  dataKey: 'universities',  icon: 'trending-up',     enabled: true },
  { key: 'search',        order: 5, titleKey: 'dashboard.tabs.search',        dataKey: 'search',        icon: 'search',          enabled: true },
  { key: 'gaps',          order: 6, titleKey: 'dashboard.tabs.gaps',          dataKey: 'gaps',          icon: 'alert-triangle',  enabled: true },
];

export const FUNNEL_NAMES = ['discovery', 'account', 'revenue', 'combined'] as const;
export type FunnelName = typeof FUNNEL_NAMES[number];

/** Source badge color mapping */
export const SOURCE_COLORS: Record<string, string> = {
  events:                 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  profiles:               'bg-green-500/10 text-green-400 border-green-500/30',
  applications:           'bg-purple-500/10 text-purple-400 border-purple-500/30',
  application_documents:  'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

/** Truth bucket definitions for overview */
export const TRUTH_BUCKETS = [
  { key: 'known_real',              color: 'text-green-400' },
  { key: 'unknown_legacy',          color: 'text-yellow-400' },
  { key: 'known_internal_or_test',  color: 'text-red-400' },
  { key: 'all_traffic',             color: 'text-muted-foreground' },
] as const;
