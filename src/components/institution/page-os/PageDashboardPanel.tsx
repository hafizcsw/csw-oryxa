/**
 * PageDashboardPanel — Facebook Professional Dashboard for page operators.
 * Two-column layout: Main (Insights + Content + Engagement) | Sidebar (Page Status + Progress + Next Steps)
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Eye, FileText, Inbox, TrendingUp, Users, Settings,
  BarChart3, CheckCircle, AlertCircle, Plus, ArrowRight, ChevronRight,
  Image, Globe, BookOpen, Home, ShieldAlert, MessageCircle,
  Sparkles, Target, Zap, Shield, Link2, Star,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { OperatorTab } from '@/components/institution/PageManageSidebar';

/** Maps each tab to the backend roles that can access it */
const TAB_PERMISSIONS: Record<string, string[]> = {
  dashboard: ['full_control', 'page_admin', 'content_publisher', 'moderator', 'inbox_agent', 'analyst', 'live_community_manager'],
  posts: ['full_control', 'page_admin', 'content_publisher'],
  programs: ['full_control', 'page_admin'],
  scholarships: ['full_control', 'page_admin'],
  inbox: ['full_control', 'page_admin', 'inbox_agent'],
  analytics: ['full_control', 'page_admin', 'analyst'],
  settings: ['full_control', 'page_admin'],
  staff: ['full_control', 'page_admin'],
  moderation: ['full_control', 'page_admin', 'moderator'],
};

function canAccess(tab: string, role: string | null | undefined, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  if (!role) return false;
  return TAB_PERMISSIONS[tab]?.includes(role) ?? false;
}

interface Props {
  universityId: string;
  universityName: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  aboutText?: string | null;
  programsCount: number;
  onNavigate: (tab: OperatorTab) => void;
  staffRole?: string | null;
  isSuperAdmin?: boolean;
}

interface InsightMetric {
  value: number;
  change?: number;
}

interface DashboardData {
  pageViews: InsightMetric;
  interactions: InsightMetric;
  inboxMessages: InsightMetric;
  totalFollows: InsightMetric;
  recentPosts: Array<{ id: string; title: string; body?: string; created_at: string; views?: number; image_url?: string }>;
}

export function PageDashboardPanel({
  universityId,
  universityName,
  logoUrl,
  coverUrl,
  aboutText,
  programsCount,
  onNavigate,
  staffRole,
  isSuperAdmin = false,
}: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeInsight, setActiveInsight] = useState(0);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await supabase.functions.invoke('university-page-manage', { body: { action: 'analytics.summary', university_id: universityId, days: 28 } });

      const summary = res?.summary;
      const events = summary?.events || {};

      const { data: posts } = await supabase.functions.invoke('university-page-manage', { body: { action: 'posts.list', university_id: universityId, limit: 3 } });

      setData({
        pageViews: { value: events['page_view'] || 0, change: 0 },
        interactions: { value: events['click'] || events['interaction'] || 0, change: 0 },
        inboxMessages: { value: summary?.inbox_threads || 0, change: 0 },
        totalFollows: { value: summary?.total_events || 0, change: 0 },
        recentPosts: (posts?.posts || []).slice(0, 3).map((p: any) => ({
          id: p.id,
          title: p.title || '',
          body: p.body?.substring(0, 80) || '',
          created_at: p.created_at,
          views: 0,
          image_url: p.image_url || null,
        })),
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [universityId]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Page completeness
  const completeness = [
    { key: 'logo', done: !!logoUrl, icon: Image, labelKey: 'pageOS.dashboard.hasLogo' },
    { key: 'cover', done: !!coverUrl, icon: Image, labelKey: 'pageOS.dashboard.hasCover' },
    { key: 'about', done: !!aboutText && aboutText.length > 20, icon: Globe, labelKey: 'pageOS.dashboard.hasAbout' },
    { key: 'programs', done: programsCount > 0, icon: BookOpen, labelKey: 'pageOS.dashboard.hasPrograms' },
  ];
  const completenessScore = Math.round((completeness.filter(c => c.done).length / completeness.length) * 100);
  const incompleteItems = completeness.filter(c => !c.done);

  // Next steps
  const nextSteps = [
    ...(!logoUrl ? [{ icon: Image, labelKey: 'pageOS.dashboard.nextSteps.addLogo', action: () => onNavigate('settings') }] : []),
    ...(!coverUrl ? [{ icon: Image, labelKey: 'pageOS.dashboard.nextSteps.addCover', action: () => onNavigate('settings') }] : []),
    ...((data?.recentPosts?.length || 0) === 0 ? [{ icon: FileText, labelKey: 'pageOS.dashboard.nextSteps.createPost', action: () => onNavigate('posts') }] : []),
    ...(!(aboutText && aboutText.length > 20) ? [{ icon: Globe, labelKey: 'pageOS.dashboard.nextSteps.addAbout', action: () => onNavigate('settings') }] : []),
  ].slice(0, 4);

  // Weekly progress goals
  const weeklyGoals = [
    { icon: FileText, labelKey: 'pageOS.dashboard.goals.createPosts', current: data?.recentPosts?.length || 0, target: 3 },
    { icon: MessageCircle, labelKey: 'pageOS.dashboard.goals.replyMessages', current: 0, target: 5 },
    { icon: Eye, labelKey: 'pageOS.dashboard.goals.getViews', current: data?.pageViews?.value || 0, target: 100 },
  ];
  const totalProgress = Math.round(weeklyGoals.reduce((sum, g) => sum + Math.min(g.current / g.target, 1), 0) / weeklyGoals.length * 100);

  if (loading) {
    return (
      <div className="fb-dash-loading">
        <div className="fb-dash-loading__spinner" />
        <span>{t('pageOS.common.loading')}</span>
      </div>
    );
  }

  const insightCards = data ? [
    { icon: Eye, label: t('pageOS.dashboard.pageViews'), value: data.pageViews.value, change: data.pageViews.change, color: 'var(--primary)' },
    { icon: MessageCircle, label: t('pageOS.dashboard.messagingConversations'), value: data.inboxMessages.value, change: data.inboxMessages.change, color: 'hsl(var(--chart-2, 142 71% 45%))' },
    { icon: TrendingUp, label: t('pageOS.dashboard.interactions'), value: data.interactions.value, change: data.interactions.change, color: 'hsl(var(--chart-3, 221 83% 53%))' },
    { icon: Users, label: t('pageOS.dashboard.totalFollows'), value: data.totalFollows.value, change: data.totalFollows.change, color: 'hsl(var(--chart-4, 25 95% 53%))' },
  ] : [];

  return (
    <div className="fb-dash">
      {/* ══════ MAIN COLUMN ══════ */}
      <div className="fb-dash__main">
        {/* ── Insights Section ── */}
        <section className="fb-dash__section">
          <div className="fb-dash__section-header">
            <div>
              <h3 className="fb-dash__section-title">{t('pageOS.dashboard.insights')}</h3>
              <p className="fb-dash__section-desc">{t('pageOS.dashboard.insightsDesc')}</p>
            </div>
            <div className="fb-dash__section-actions">
              <span className="fb-dash__period-badge">{t('pageOS.dashboard.last28Days')}</span>
              <button className="fb-dash__see-all" onClick={() => onNavigate('analytics')}>
                {t('pageOS.dashboard.seeAll')}
              </button>
            </div>
          </div>

          <div className="fb-dash__insights-grid">
            {insightCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <button
                  key={i}
                  className={`fb-dash__insight-card ${activeInsight === i ? 'fb-dash__insight-card--active' : ''}`}
                  onClick={() => { setActiveInsight(i); onNavigate('analytics'); }}
                >
                  <Icon className="fb-dash__insight-icon" style={{ color: card.color }} />
                  <div className="fb-dash__insight-value">{card.value.toLocaleString()}</div>
                  {card.change !== undefined && card.change !== 0 && (
                    <span className={`fb-dash__insight-change ${card.change > 0 ? 'fb-dash__insight-change--up' : 'fb-dash__insight-change--down'}`}>
                      {card.change > 0 ? '↑' : '↓'} {Math.abs(card.change)}%
                    </span>
                  )}
                  <div className="fb-dash__insight-label">{card.label}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Content Section ── */}
        <section className="fb-dash__section">
          <div className="fb-dash__section-header">
            <div>
              <h3 className="fb-dash__section-title">{t('pageOS.dashboard.content')}</h3>
              <p className="fb-dash__section-desc">{t('pageOS.dashboard.contentDesc')}</p>
            </div>
            <button className="fb-dash__see-all" onClick={() => onNavigate('posts')}>
              {t('pageOS.dashboard.seeAll')}
            </button>
          </div>

          {data?.recentPosts && data.recentPosts.length > 0 ? (
            <div className="fb-dash__content-list">
              {data.recentPosts.map(post => (
                <div key={post.id} className="fb-dash__content-item" onClick={() => onNavigate('posts')}>
                  <div className="fb-dash__content-thumb">
                    {post.image_url ? (
                      <img src={post.image_url} alt="" />
                    ) : (
                      <FileText className="w-6 h-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="fb-dash__content-info">
                    <span className="fb-dash__content-title">{post.title || post.body || '...'}</span>
                    <span className="fb-dash__content-date">
                      {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="fb-dash__content-stats">
                    <div className="fb-dash__content-stat">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{post.views ?? 0}</span>
                      <span className="fb-dash__content-stat-label">{t('pageOS.dashboard.views')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="fb-dash__empty-content">
              <FileText className="w-10 h-10 text-muted-foreground/20" />
              <p>{t('pageOS.dashboard.noPosts')}</p>
              <button className="fb-dash__create-btn" onClick={() => onNavigate('posts')}>
                <Plus className="w-4 h-4" /> {t('pageOS.dashboard.createPost')}
              </button>
            </div>
          )}
        </section>

        {/* ── Quick Tools ── */}
        <section className="fb-dash__section">
          <h3 className="fb-dash__section-title">{t('pageOS.dashboard.pageTools')}</h3>
          <div className="fb-dash__tools-grid">
            {([
              { key: 'posts' as OperatorTab, icon: FileText, labelKey: 'pageOS.toolbar.posts', desc: 'pageOS.dashboard.tools.postsDesc' },
              { key: 'inbox' as OperatorTab, icon: Inbox, labelKey: 'pageOS.toolbar.inbox', desc: 'pageOS.dashboard.tools.inboxDesc' },
              { key: 'analytics' as OperatorTab, icon: BarChart3, labelKey: 'pageOS.toolbar.analytics', desc: 'pageOS.dashboard.tools.analyticsDesc' },
              { key: 'staff' as OperatorTab, icon: Users, labelKey: 'pageOS.toolbar.staff', desc: 'pageOS.dashboard.tools.staffDesc' },
              { key: 'moderation' as OperatorTab, icon: ShieldAlert, labelKey: 'pageOS.toolbar.moderation', desc: 'pageOS.dashboard.tools.moderationDesc' },
              { key: 'settings' as OperatorTab, icon: Settings, labelKey: 'pageOS.toolbar.settings', desc: 'pageOS.dashboard.tools.settingsDesc' },
            ]).filter(tool => canAccess(tool.key as string, staffRole, isSuperAdmin)).map(tool => {
              const Icon = tool.icon;
              return (
                <button key={tool.key} className="fb-dash__tool-card" onClick={() => onNavigate(tool.key)}>
                  <div className="fb-dash__tool-icon-wrap">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="fb-dash__tool-info">
                    <span className="fb-dash__tool-name">{t(tool.labelKey)}</span>
                    <span className="fb-dash__tool-desc">{t(tool.desc)}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* ══════ SIDEBAR ══════ */}
      <div className="fb-dash__sidebar">
        {/* ── Page Status ── */}
        <section className="fb-dash__sidebar-card">
          <h4 className="fb-dash__sidebar-title">{t('pageOS.dashboard.pageStatus')}</h4>
          <div className="fb-dash__status-header">
            <div className="fb-dash__status-logo">
              {logoUrl ? <img src={logoUrl} alt="" /> : <Shield className="w-5 h-5 text-muted-foreground" />}
              {completenessScore === 100 && (
                <div className="fb-dash__status-check"><CheckCircle className="w-4 h-4" /></div>
              )}
            </div>
            <div className="fb-dash__status-info">
              <span className="fb-dash__status-name">{universityName}</span>
              <span className="fb-dash__status-desc">
                {completenessScore === 100
                  ? t('pageOS.dashboard.pageComplete')
                  : t('pageOS.dashboard.pageIncomplete', { count: incompleteItems.length })
                }
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="fb-dash__completeness">
            <div className="fb-dash__completeness-header">
              <span>{t('pageOS.dashboard.completeness')}</span>
              <span className="fb-dash__completeness-pct">{completenessScore}%</span>
            </div>
            <div className="fb-dash__completeness-bar">
              <div className="fb-dash__completeness-fill" style={{ width: `${completenessScore}%` }} />
            </div>
          </div>

          <div className="fb-dash__checklist">
            {completeness.map(item => (
              <div key={item.key} className={`fb-dash__checklist-item ${item.done ? 'fb-dash__checklist-item--done' : ''}`}>
                {item.done ? (
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span>{t(item.labelKey)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Weekly Progress ── */}
        <section className="fb-dash__sidebar-card">
          <div className="fb-dash__sidebar-card-header">
            <h4 className="fb-dash__sidebar-title">{t('pageOS.dashboard.weeklyProgress')}</h4>
            <span className="fb-dash__period-badge">{totalProgress}%</span>
          </div>
          <div className="fb-dash__progress-bar-mini">
            <div className="fb-dash__progress-bar-mini-fill" style={{ width: `${totalProgress}%` }} />
          </div>

          <div className="fb-dash__goals">
            {weeklyGoals.map((goal, i) => {
              const Icon = goal.icon;
              const pct = Math.min(Math.round((goal.current / goal.target) * 100), 100);
              return (
                <div key={i} className="fb-dash__goal">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="fb-dash__goal-info">
                    <span className="fb-dash__goal-label">{t(goal.labelKey)}</span>
                    <span className="fb-dash__goal-progress">{goal.current}/{goal.target}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Next Steps ── */}
        {nextSteps.length > 0 && (
          <section className="fb-dash__sidebar-card">
            <h4 className="fb-dash__sidebar-title">{t('pageOS.dashboard.nextStepsTitle')}</h4>
            <div className="fb-dash__next-steps">
              {nextSteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <button key={i} className="fb-dash__next-step" onClick={step.action}>
                    <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t(step.labelKey)}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 ms-auto" />
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
