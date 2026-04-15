/**
 * UniversityIntelligencePanel — Full intelligence & optimization dashboard
 * for university page operators. All data from real persisted sources.
 * 
 * Sections: Analytics, Funnel, ORX Guidance, Operator Priorities, Diagnostics, Templates
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUniversityIntelligence } from '@/hooks/useUniversityIntelligence';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BarChart3, TrendingUp, AlertTriangle, Clock, CheckCircle2, XCircle,
  Loader2, RefreshCw, Target, Zap, FileText, MessageCircle, Users,
  ArrowRight, ChevronRight, Eye, Inbox, AlertCircle, Timer, Activity,
  Copy, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  universityId: string;
}

export function UniversityIntelligencePanel({ universityId }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const {
    analytics, priorities, orx, diagnostics, templates,
    loading, fetchAll,
  } = useUniversityIntelligence(universityId);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const anyLoading = Object.values(loading).some(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t('intelligence.title')}</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={anyLoading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${anyLoading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">{t('intelligence.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="priorities">{t('intelligence.tabs.priorities')}</TabsTrigger>
          <TabsTrigger value="orx">{t('intelligence.tabs.orx')}</TabsTrigger>
          <TabsTrigger value="diagnostics">{t('intelligence.tabs.diagnostics')}</TabsTrigger>
          <TabsTrigger value="templates">{t('intelligence.tabs.templates')}</TabsTrigger>
        </TabsList>

        {/* ════════ OVERVIEW ════════ */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {loading.analytics ? <LoadingState /> : analytics ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard icon={Eye} label={t('intelligence.kpi.pageViews')} value={analytics.page_views} />
                <KpiCard icon={MessageCircle} label={t('intelligence.kpi.inquiries')} value={analytics.inquiries} />
                <KpiCard icon={ClipboardList} label={t('intelligence.kpi.applications')} value={analytics.applications} />
                <KpiCard icon={Timer} label={t('intelligence.kpi.avgResponse')} value={analytics.avg_response_time_hours != null ? `${analytics.avg_response_time_hours}h` : '—'} />
              </div>

              {/* Decision Summary */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t('intelligence.decisions.title')}</h3>
                <div className="flex gap-4 flex-wrap">
                  <DecisionBadge label={t('intelligence.decisions.accepted')} count={analytics.decisions.accepted} color="text-green-600" />
                  <DecisionBadge label={t('intelligence.decisions.rejected')} count={analytics.decisions.rejected} color="text-red-600" />
                  <DecisionBadge label={t('intelligence.decisions.waitlisted')} count={analytics.decisions.waitlisted} color="text-amber-600" />
                </div>
              </div>

              {/* Conversion Funnel */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t('intelligence.funnel.title')}</h3>
                <div className="space-y-2">
                  {[
                    { key: 'page_views', value: analytics.funnel.page_views },
                    { key: 'inquiries', value: analytics.funnel.inquiries },
                    { key: 'applications', value: analytics.funnel.applications },
                    { key: 'under_review', value: analytics.funnel.under_review },
                    { key: 'decisions', value: analytics.funnel.decisions },
                  ].map((step, i, arr) => {
                    const maxVal = arr[0].value || 1;
                    const pct = Math.round((step.value / maxVal) * 100);
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24 shrink-0 text-end">{t(`intelligence.funnel.${step.key}`)}</span>
                        <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
                          <div
                            className="h-full bg-primary/70 rounded-md transition-all"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                            {step.value}
                          </span>
                        </div>
                        {i < arr.length - 1 && arr[i + 1].value > 0 && step.value > 0 && (
                          <span className="text-xs text-muted-foreground w-12">
                            {Math.round((arr[i + 1].value / step.value) * 100)}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Programs */}
              {analytics.top_programs.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t('intelligence.topPrograms.title')}</h3>
                  <div className="space-y-2">
                    {analytics.top_programs.slice(0, 5).map((prog, i) => (
                      <div key={prog.program_id} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                        <span className="flex-1 text-sm text-foreground truncate">
                          {language === 'ar' && prog.name_ar ? prog.name_ar : prog.name_en}
                        </span>
                        <Badge variant="secondary" className="text-xs">{prog.degree_level}</Badge>
                        <span className="text-sm font-medium text-foreground">{prog.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Operational Health */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <HealthCard
                  icon={AlertTriangle}
                  label={t('intelligence.health.stalledCases')}
                  value={analytics.stalled_cases}
                  status={analytics.stalled_cases === 0 ? 'good' : analytics.stalled_cases <= 3 ? 'warn' : 'bad'}
                />
                <HealthCard
                  icon={FileText}
                  label={t('intelligence.health.pendingDocs')}
                  value={analytics.doc_request_friction.pending}
                  status={analytics.doc_request_friction.pending === 0 ? 'good' : 'warn'}
                />
                <HealthCard
                  icon={MessageCircle}
                  label={t('intelligence.health.needsReply')}
                  value={analytics.threads_needing_reply}
                  status={analytics.threads_needing_reply === 0 ? 'good' : analytics.threads_needing_reply <= 3 ? 'warn' : 'bad'}
                />
              </div>
            </>
          ) : <EmptyState message={t('intelligence.noData')} />}
        </TabsContent>

        {/* ════════ PRIORITIES ════════ */}
        <TabsContent value="priorities" className="space-y-4 mt-4">
          {loading.priorities ? <LoadingState /> : priorities ? (
            <>
              {priorities.high_priority_apps.length > 0 && (
                <PrioritySection
                  title={t('intelligence.priorities.highPriority')}
                  icon={Zap}
                  items={priorities.high_priority_apps}
                  renderItem={(app: any) => (
                    <div key={app.id} className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-foreground">
                          {language === 'ar' && app.programs?.name_ar ? app.programs.name_ar : app.programs?.name_en || app.program_id?.slice(0, 8)}
                        </span>
                        <div className="text-xs text-muted-foreground">{t('intelligence.kpi.score')}: {app.overall_score}%</div>
                      </div>
                      <Badge variant="secondary">{app.status}</Badge>
                    </div>
                  )}
                />
              )}

              {priorities.overdue_reviews.length > 0 && (
                <PrioritySection
                  title={t('intelligence.priorities.overdueReviews')}
                  icon={Clock}
                  items={priorities.overdue_reviews}
                  renderItem={(app: any) => (
                    <div key={app.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                        {language === 'ar' && app.programs?.name_ar ? app.programs.name_ar : app.programs?.name_en}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(app.submitted_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                />
              )}

              {priorities.threads_needing_reply.length > 0 && (
                <PrioritySection
                  title={t('intelligence.priorities.unrepliedThreads')}
                  icon={MessageCircle}
                  items={priorities.threads_needing_reply}
                  renderItem={(thread: any) => (
                    <div key={thread.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground flex-1 min-w-0 truncate">{thread.subject || thread.last_message_preview}</span>
                      <span className="text-xs text-muted-foreground">{thread.thread_type}</span>
                    </div>
                  )}
                />
              )}

              {priorities.stalled_cases.length > 0 && (
                <PrioritySection
                  title={t('intelligence.priorities.stalledCases')}
                  icon={AlertTriangle}
                  items={priorities.stalled_cases}
                  renderItem={(app: any) => (
                    <div key={app.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                        {language === 'ar' && app.programs?.name_ar ? app.programs.name_ar : app.programs?.name_en}
                      </span>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{app.status}</Badge>
                    </div>
                  )}
                />
              )}

              {priorities.overdue_reviews.length === 0 && priorities.threads_needing_reply.length === 0 && priorities.stalled_cases.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-60" />
                  <p>{t('intelligence.priorities.allClear')}</p>
                </div>
              )}
            </>
          ) : <EmptyState message={t('intelligence.noData')} />}
        </TabsContent>

        {/* ════════ ORX GUIDANCE ════════ */}
        <TabsContent value="orx" className="space-y-4 mt-4">
          {loading.orx ? <LoadingState /> : orx ? (
            <>
              {/* Composite Score */}
              <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{t('intelligence.orx.compositeScore')}</h3>
                <div className="text-5xl font-bold text-foreground">{orx.composite_score}</div>
                <Progress value={orx.composite_score} className="h-2 max-w-xs mx-auto" />
                <p className="text-xs text-muted-foreground">{t('intelligence.orx.scoreExplanation')}</p>
              </div>

              {/* Factor Breakdown */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">{t('intelligence.orx.factors')}</h3>
                <div className="space-y-3">
                  {orx.factors.map(factor => (
                    <div key={factor.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{t(`intelligence.orx.factor.${factor.name}`)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{factor.score}</span>
                          {factor.improvable && (
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </div>
                      </div>
                      <Progress value={factor.score} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">{t(factor.guidance)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Actions */}
              {orx.top_actions.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    {t('intelligence.orx.topActions')}
                  </h3>
                  <div className="space-y-2">
                    {orx.top_actions.map((action, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                        <span className="text-sm font-medium text-primary w-5">{i + 1}.</span>
                        <div className="flex-1">
                          <span className="text-sm text-foreground">{t(`intelligence.orx.factor.${action.factor}`)}</span>
                          <p className="text-xs text-muted-foreground">{t(action.guidance_key)}</p>
                        </div>
                        <Badge variant="outline">{action.current_score}/100</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Sources */}
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{t('intelligence.orx.dataSources')}</p>
              </div>
            </>
          ) : <EmptyState message={t('intelligence.noData')} />}
        </TabsContent>

        {/* ════════ DIAGNOSTICS ════════ */}
        <TabsContent value="diagnostics" className="space-y-4 mt-4">
          {loading.diagnostics ? <LoadingState /> : diagnostics ? (
            <>
              {/* Drop-off Rate */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">{t('intelligence.diagnostics.dropOffRate')}</h4>
                  <div className="text-3xl font-bold text-foreground">{diagnostics.drop_off_rate}%</div>
                  <p className="text-xs text-muted-foreground">{t('intelligence.diagnostics.dropOffDesc')}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">{t('intelligence.diagnostics.totalApps')}</h4>
                  <div className="text-3xl font-bold text-foreground">{diagnostics.total_applications}</div>
                </div>
              </div>

              {/* Status Bottlenecks */}
              {Object.keys(diagnostics.avg_status_durations_hours).length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t('intelligence.diagnostics.statusDurations')}</h3>
                  <div className="space-y-2">
                    {Object.entries(diagnostics.avg_status_durations_hours)
                      .sort(([, a], [, b]) => b - a)
                      .map(([status, hours]) => (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-sm text-foreground">{t(`intake.status.${status}`)}</span>
                          <span className={`text-sm font-medium ${hours > 72 ? 'text-red-600' : hours > 24 ? 'text-amber-600' : 'text-green-600'}`}>
                            {hours < 1 ? '<1h' : `${hours}h`}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Programs without applications */}
              {diagnostics.programs_no_applications.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t('intelligence.diagnostics.programsNoApps')}</h3>
                  <div className="space-y-2">
                    {diagnostics.programs_no_applications.map(prog => (
                      <div key={prog.id} className="flex items-center gap-2">
                        <span className="text-sm text-foreground flex-1 truncate">
                          {language === 'ar' && prog.name_ar ? prog.name_ar : prog.name_en}
                        </span>
                        <Badge variant="secondary" className="text-xs">{prog.degree_level}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overdue by Program */}
              {diagnostics.overdue_by_program.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{t('intelligence.diagnostics.overdueByProgram')}</h3>
                  <div className="space-y-2">
                    {diagnostics.overdue_by_program.map(item => (
                      <div key={item.program_id} className="flex items-center justify-between">
                        <span className="text-sm text-foreground flex-1 truncate">
                          {language === 'ar' && item.name_ar ? item.name_ar : item.name_en}
                        </span>
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : <EmptyState message={t('intelligence.noData')} />}
        </TabsContent>

        {/* ════════ TEMPLATES ════════ */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          {loading.templates ? <LoadingState /> : templates ? (
            <>
              <TemplateSection title={t('intelligence.templates.docRequests')} items={templates.doc_request} />
              <TemplateSection title={t('intelligence.templates.decisions')} items={templates.decision} />
              <TemplateSection title={t('intelligence.templates.followUps')} items={templates.follow_up} />
            </>
          ) : <EmptyState message={t('intelligence.noData')} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-components ──

function KpiCard({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

function DecisionBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xl font-bold ${color}`}>{count}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function HealthCard({ icon: Icon, label, value, status }: { icon: typeof AlertTriangle; label: string; value: number; status: 'good' | 'warn' | 'bad' }) {
  const colors = { good: 'text-green-600', warn: 'text-amber-600', bad: 'text-red-600' };
  const bgColors = { good: 'bg-green-50 dark:bg-green-900/10', warn: 'bg-amber-50 dark:bg-amber-900/10', bad: 'bg-red-50 dark:bg-red-900/10' };
  return (
    <div className={`rounded-xl border border-border p-4 space-y-1 ${bgColors[status]}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${colors[status]}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${colors[status]}`}>{value}</div>
    </div>
  );
}

function PrioritySection({ title, icon: Icon, items, renderItem }: {
  title: string; icon: typeof Clock; items: any[]; renderItem: (item: any) => React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <div className="space-y-2">
        {items.map(renderItem)}
      </div>
    </div>
  );
}

function TemplateSection({ title, items }: { title: string; items: Array<{ id: string; label_key: string; message_key: string }> }) {
  const { t } = useTranslation();
  const copyTemplate = (msgKey: string) => {
    const text = t(msgKey);
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t('intelligence.templates.copied'));
    }).catch(() => {});
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors">
            <div className="flex-1 min-w-0">
              <span className="text-sm text-foreground">{t(item.label_key)}</span>
              <p className="text-xs text-muted-foreground truncate">{t(item.message_key)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => copyTemplate(item.message_key)} className="shrink-0 gap-1">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
      <p>{message}</p>
    </div>
  );
}
