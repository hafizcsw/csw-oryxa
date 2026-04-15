import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, RefreshCw, Search, Activity, Shield, Eye, AlertTriangle, CheckCircle2,
  XCircle, Clock, BarChart3, Globe, GraduationCap, Building2, ChevronRight,
  ArrowUpDown, ArrowDown, ArrowUp, ExternalLink, AlertCircle, Play, Pause,
  Square, RotateCcw, Zap, TrendingUp, Timer, Server, Ban
} from 'lucide-react';
import { useOrxSummary, useOrxEntities, useOrxEntityDetail, useOrxAction, type OrxEntity, type CrawlStats } from '@/hooks/useOrxControlPanel';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// ── Crawl Queue Strip ──
function CrawlQueueStrip({ stats, loading, t }: { stats?: CrawlStats; loading: boolean; t: any }) {
  const items = [
    { key: 'running', value: stats?.running, icon: Play, cls: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'queued', value: stats?.queued, icon: Clock, cls: 'text-amber-600 dark:text-amber-400' },
    { key: 'paused', value: stats?.paused, icon: Pause, cls: 'text-sky-600 dark:text-sky-400' },
    { key: 'failed', value: stats?.failed, icon: XCircle, cls: 'text-destructive' },
    { key: 'completed', value: stats?.completed, icon: CheckCircle2, cls: 'text-emerald-500 dark:text-emerald-400' },
    { key: 'cancelled', value: stats?.cancelled, icon: Ban, cls: 'text-muted-foreground' },
  ];

  return (
    <div className="rounded-xl border bg-card/50 backdrop-blur-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Server className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{t('orxControl.crawlQueue')}</span>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {items.map(it => (
          <div key={it.key} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
            <it.icon className={`w-4 h-4 ${it.cls}`} />
            <span className="text-lg font-bold tabular-nums">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (it.value ?? 0)}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">{t(`orxControl.crawl.${it.key}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Summary Cards ──
function SummaryCards({ summary, loading, error, t }: { summary: any; loading: boolean; error: any; t: any }) {
  const cards = [
    { key: 'totalTracked', value: summary?.total, icon: Activity, gradient: 'from-slate-600 to-slate-800 dark:from-slate-400 dark:to-slate-600' },
    { key: 'scored', value: summary?.scored, icon: CheckCircle2, gradient: 'from-emerald-500 to-teal-600' },
    { key: 'evaluating', value: summary?.evaluating, icon: Clock, gradient: 'from-amber-500 to-orange-600' },
    { key: 'insufficient', value: summary?.insufficient, icon: AlertTriangle, gradient: 'from-red-500 to-rose-600' },
    { key: 'betaApproved', value: summary?.beta_approved, icon: Shield, gradient: 'from-blue-500 to-indigo-600' },
    { key: 'betaCandidate', value: summary?.beta_candidate, icon: Eye, gradient: 'from-violet-500 to-purple-600' },
    { key: 'blockedLayer', value: summary?.blocked_missing_layer, icon: XCircle, gradient: 'from-orange-500 to-red-500' },
    { key: 'blockedConf', value: summary?.blocked_low_confidence, icon: XCircle, gradient: 'from-rose-400 to-red-600' },
  ];

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-5">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span className="font-semibold">{t('orxControl.summary.failedToLoad')}</span>
        </div>
        <p className="text-xs text-destructive/70 mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.key}
          className="group relative flex flex-col items-center p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
        >
          <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-primary to-transparent" />
          <div className={`relative w-11 h-11 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center mb-2 shadow-lg group-hover:scale-105 transition-transform`}>
            <c.icon className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (c.value ?? 0)}
          </p>
          <p className="text-[11px] text-muted-foreground text-center font-medium mt-0.5">{t(`orxControl.summary.${c.key}`)}</p>
        </div>
      ))}
    </div>
  );
}

// ── Progress Bar ──
function ProgressBar({ value }: { value: number }) {
  const color = value >= 90 ? 'bg-emerald-500' : value >= 60 ? 'bg-blue-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] font-mono tabular-nums w-7 text-end">{value}%</span>
    </div>
  );
}

// ── Crawl Status Badge ──
function CrawlStatusBadge({ status, t }: { status: string; t: any }) {
  const map: Record<string, { bg: string; icon: any }> = {
    idle: { bg: 'bg-muted text-muted-foreground', icon: null },
    queued: { bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
    running: { bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Play },
    paused: { bg: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400', icon: Pause },
    completed: { bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
    failed: { bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
    cancelled: { bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Ban },
  };
  const m = map[status] || map.idle;
  const Icon = m.icon;
  const label = t(`orxControl.crawl.${status}`, { defaultValue: status });
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.bg}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}

// ── Entity Type Icon ──
function EntityIcon({ type }: { type: string }) {
  if (type === 'university') return <Building2 className="w-4 h-4 text-blue-500" />;
  if (type === 'program') return <GraduationCap className="w-4 h-4 text-violet-500" />;
  return <Globe className="w-4 h-4 text-emerald-500" />;
}

// ── Status Badge ──
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scored: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    evaluating: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    insufficient: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
}

function ExposureBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    beta_approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    beta_candidate: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    internal_only: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    blocked_missing_layer: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    blocked_low_confidence: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    blocked_uncalibrated: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[status] || 'bg-muted text-muted-foreground'}`}>{status?.replace(/_/g, ' ')}</span>;
}

// ── Needs Attention ──
function NeedsAttention({ entity, t }: { entity: OrxEntity; t: any }) {
  const issues: { key: string; label: string }[] = [];
  if ((entity.confidence ?? 0) < 50 && entity.status === 'scored') issues.push({ key: 'lowConf', label: t('orxControl.attention.lowConfidence') });
  if (entity.exposure_status?.startsWith('blocked_')) issues.push({ key: 'blocked', label: t('orxControl.attention.blocked') });
  if (entity.published_facts_count === 0 && entity.status === 'scored') issues.push({ key: 'noFacts', label: t('orxControl.attention.noPublishedFacts') });
  if (entity.crawl_status === 'failed') issues.push({ key: 'crawlFail', label: t('orxControl.attention.crawlFailed') });
  if (issues.length === 0) return null;
  return (
    <div className="flex gap-1 mt-0.5">
      {issues.map(i => (
        <span key={i.key} className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">{i.label}</span>
      ))}
    </div>
  );
}

// ── Inline Crawl Actions ──
function InlineCrawlActions({ entity, onAction, t }: { entity: OrxEntity; onAction: (action: string, params: any) => void; t: any }) {
  const cs = entity.crawl_status;
  return (
    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
      {(cs === 'idle' || cs === 'completed' || cs === 'cancelled' || cs === 'failed') && (
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => onAction('crawl-start', { entity_id: entity.entity_id, entity_type: entity.entity_type })}>
          <Play className="w-3 h-3" /> {t('orxControl.crawl.start')}
        </Button>
      )}
      {cs === 'running' && (
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => onAction('crawl-pause', { entity_id: entity.entity_id })}>
          <Pause className="w-3 h-3" /> {t('orxControl.crawl.pause')}
        </Button>
      )}
      {cs === 'paused' && (
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => onAction('crawl-resume', { entity_id: entity.entity_id })}>
          <Play className="w-3 h-3" /> {t('orxControl.crawl.resume')}
        </Button>
      )}
      {(cs === 'running' || cs === 'paused' || cs === 'queued') && (
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1 text-destructive" onClick={() => onAction('crawl-cancel', { entity_id: entity.entity_id })}>
          <Square className="w-3 h-3" /> {t('orxControl.crawl.stop')}
        </Button>
      )}
      {cs === 'failed' && (
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => onAction('crawl-retry', { entity_id: entity.entity_id, entity_type: entity.entity_type })}>
          <RotateCcw className="w-3 h-3" /> {t('orxControl.crawl.retry')}
        </Button>
      )}
    </div>
  );
}

// ── Detail Drawer ──
function EntityDetailDrawer({ entityId, onClose, t }: { entityId: string; onClose: () => void; t: any }) {
  const { data, isLoading, error, refetch } = useOrxEntityDetail(entityId);
  const action = useOrxAction();

  const detail = data;
  const score = detail?.score;
  const crawlJobs: any[] = detail?.crawl_jobs || [];
  const crawlAudit: any[] = detail?.crawl_audit || [];
  const latestJob = crawlJobs[0] || null;

  const handleFactAction = async (factId: string, toStatus: string, factTable: string) => {
    try {
      await action.mutateAsync({ action: 'transition-fact', fact_id: factId, to_status: toStatus, entity_id: entityId, fact_table: factTable });
      toast.success(t('orxControl.toast.factTransitioned', { status: toStatus }));
      refetch();
    } catch (e: any) {
      toast.error(e?.message || t('orxControl.toast.actionFailed'));
    }
  };

  const handleCrawlAction = async (actionName: string, extraParams?: any) => {
    try {
      await action.mutateAsync({ action: actionName, entity_id: entityId, entity_type: score?.entity_type, ...extraParams });
      toast.success(t('orxControl.toast.actionExecuted', { action: actionName.replace('crawl-', '') }));
      refetch();
    } catch (e: any) {
      toast.error(e?.message || t('orxControl.toast.actionFailed'));
    }
  };

  return (
    <Sheet open onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg flex items-center gap-2">
            {score?.entity_type && <EntityIcon type={score.entity_type} />}
            {detail?.entity_name || entityId}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="py-4 space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">{t('orxControl.entity.failedToLoad')}</span>
            </div>
            <p className="text-xs text-destructive/70">{(error as Error).message}</p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">{t('orxControl.detail.identity')}</TabsTrigger>
              <TabsTrigger value="crawl" className="flex-1">{t('orxControl.crawl.operations')}</TabsTrigger>
              <TabsTrigger value="facts" className="flex-1">{t('orxControl.detail.lifecycle')}</TabsTrigger>
            </TabsList>

            {/* ═══ OVERVIEW TAB ═══ */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{t('orxControl.detail.identity')}</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.entityId')}</span><code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{entityId}</code></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.type')}</span><span className="capitalize">{score?.entity_type}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.status')}</span><StatusBadge status={score?.status} /></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.exposure')}</span><ExposureBadge status={score?.exposure_status} /></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.progress')}</span><span className="font-mono">{detail?.progress_percent}%</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{t('orxControl.detail.scoresRanking')}</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t('orxControl.detail.compositeScore')}</span>
                    <span className="text-xl font-bold tabular-nums">{score?.score ?? '—'}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.confidence')}</span><span className="font-mono tabular-nums">{score?.confidence ?? '—'}</span></div>
                  <Separator className="my-1.5" />
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.countryScore')}</span><span className="font-mono tabular-nums">{score?.country_score ?? '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.universityScore')}</span><span className="font-mono tabular-nums">{score?.university_score ?? '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.programScore')}</span><span className="font-mono tabular-nums">{score?.program_score ?? '—'}</span></div>
                  <Separator className="my-1.5" />
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.globalRank')}</span><span className="font-mono tabular-nums">{score?.rank_global ? `#${score.rank_global}` : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.countryRank')}</span><span className="font-mono tabular-nums">{score?.rank_country ? `#${score.rank_country}` : '—'}</span></div>
                  <Separator className="my-1.5" />
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.badges')}</span><span>{score?.badges?.length ? score.badges.join(', ') : t('orxControl.detail.none')}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.methodology')}</span><span className="font-mono">{score?.methodology_version || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.evaluatedAt')}</span><span className="text-[10px]">{score?.evaluated_at ? formatDistanceToNow(new Date(score.evaluated_at), { addSuffix: true }) : '—'}</span></div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══ CRAWL TAB ═══ */}
            <TabsContent value="crawl" className="space-y-4 mt-4">
              <Card className={latestJob?.status === 'running' ? 'border-emerald-500/40 bg-emerald-500/5' : latestJob?.status === 'failed' ? 'border-destructive/40 bg-destructive/5' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Server className="w-4 h-4" /> {t('orxControl.crawl.operations')}
                    {latestJob && <CrawlStatusBadge status={latestJob.status} t={t} />}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {latestJob ? (
                    <>
                      <div className="space-y-1.5">
                        <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.crawl.jobType')}</span><span className="font-mono">{latestJob.job_type}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.crawl.currentStage')}</span><span className="font-mono font-medium">{latestJob.current_stage}</span></div>
                        {latestJob.pages_total_estimate > 0 && (
                          <div className="pt-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>{t('orxControl.crawl.pages')}: {latestJob.pages_processed}/{latestJob.pages_total_estimate}</span>
                              <span>{Math.round((latestJob.pages_processed / latestJob.pages_total_estimate) * 100)}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (latestJob.pages_processed / latestJob.pages_total_estimate) * 100)}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {[
                          ['pagesDiscovered', latestJob.pages_discovered],
                          ['pagesFetched', latestJob.pages_fetched],
                          ['pagesProcessed', latestJob.pages_processed],
                          ['evidenceCreated', latestJob.evidence_created],
                          ['factsCreated', latestJob.facts_created],
                          ['scoreUpdated', latestJob.score_updated ? '✓' : '—'],
                          ['retries', latestJob.retry_count],
                        ].map(([k, v]) => (
                          <div key={k as string} className="flex justify-between">
                            <span className="text-muted-foreground">{t(`orxControl.crawl.${k}`)}</span>
                            <span className="font-mono tabular-nums">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <div className="space-y-1">
                        {latestJob.started_at && <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.crawl.started')}</span><span className="text-[10px]">{formatDistanceToNow(new Date(latestJob.started_at), { addSuffix: true })}</span></div>}
                        {latestJob.finished_at && <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.crawl.finished')}</span><span className="text-[10px]">{formatDistanceToNow(new Date(latestJob.finished_at), { addSuffix: true })}</span></div>}
                        {latestJob.last_heartbeat_at && <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.crawl.lastHeartbeat')}</span><span className="text-[10px]">{formatDistanceToNow(new Date(latestJob.last_heartbeat_at), { addSuffix: true })}</span></div>}
                      </div>
                      {latestJob.last_error && (
                        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2.5 text-[10px] text-destructive">
                          <strong>Error:</strong> {latestJob.last_error}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">{t('orxControl.crawl.noJobs')}</p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {(!latestJob || ['idle', 'completed', 'cancelled', 'failed'].includes(latestJob?.status)) && (
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleCrawlAction('crawl-start')} disabled={action.isPending}>
                        <Play className="w-3 h-3" /> {t('orxControl.crawl.start')}
                      </Button>
                    )}
                    {latestJob?.status === 'running' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleCrawlAction('crawl-pause')} disabled={action.isPending}>
                        <Pause className="w-3 h-3" /> {t('orxControl.crawl.pause')}
                      </Button>
                    )}
                    {latestJob?.status === 'paused' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleCrawlAction('crawl-resume')} disabled={action.isPending}>
                        <Play className="w-3 h-3" /> {t('orxControl.crawl.resume')}
                      </Button>
                    )}
                    {['running', 'paused', 'queued'].includes(latestJob?.status) && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive" onClick={() => handleCrawlAction('crawl-cancel')} disabled={action.isPending}>
                        <Square className="w-3 h-3" /> {t('orxControl.crawl.cancel')}
                      </Button>
                    )}
                    {latestJob?.status === 'failed' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleCrawlAction('crawl-retry')} disabled={action.isPending}>
                        <RotateCcw className="w-3 h-3" /> {t('orxControl.crawl.retry')}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleCrawlAction('crawl-rescore')} disabled={action.isPending}>
                      <Zap className="w-3 h-3" /> {t('orxControl.crawl.rescore')}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleCrawlAction('crawl-repromote')} disabled={action.isPending}>
                      <TrendingUp className="w-3 h-3" /> {t('orxControl.crawl.repromote')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {crawlAudit.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{t('orxControl.crawl.auditLog')} ({crawlAudit.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {crawlAudit.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2 text-[10px] border-b pb-1.5">
                        <span className="font-semibold shrink-0">{a.action}</span>
                        {a.reason && <span className="text-muted-foreground truncate">— {a.reason}</span>}
                        <span className="ms-auto shrink-0 text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ═══ FACTS TAB ═══ */}
            <TabsContent value="facts" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{t('orxControl.detail.lifecycle')}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t('orxControl.detail.evidenceCount')}</span><span className="font-mono font-bold tabular-nums">{detail?.evidence_count ?? 0}</span></div>
                  {detail?.facts_by_status && Object.keys(detail.facts_by_status).length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1">{t('orxControl.detail.enrichmentFactsByStatus')}:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(detail.facts_by_status).map(([status, count]) => (
                          <Badge key={status} variant="outline" className="text-[10px]">{status}: {String(count)}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {detail?.dim_facts_by_status && Object.keys(detail.dim_facts_by_status).length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1">{t('orxControl.detail.dimensionFactsByStatus')}:</p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(detail.dim_facts_by_status).map(([status, count]) => (
                          <Badge key={status} variant="outline" className="text-[10px]">{status}: {String(count)}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {detail?.source_domains?.length > 0 && (
                    <div>
                      <p className="text-muted-foreground mb-1">{t('orxControl.detail.sourceDomains')}:</p>
                      <div className="flex flex-wrap gap-1">
                        {detail.source_domains.map((d: string) => (
                          <span key={d} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted font-mono">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {detail?.enrichment_facts?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{t('orxControl.detail.enrichmentFacts')} ({detail.enrichment_facts.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
                    {detail.enrichment_facts.map((f: any) => (
                      <div key={f.id} className="border rounded-lg p-2.5 text-xs space-y-1.5 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{f.fact_type}</span>
                          <StatusBadge status={f.status} />
                        </div>
                        {f.display_text && <p className="text-muted-foreground text-[10px] line-clamp-2">{f.display_text}</p>}
                        {f.source_url && (
                          <a href={f.source_url} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> {f.source_domain || t('orxControl.detail.source')}
                          </a>
                        )}
                        <div className="flex gap-1 pt-0.5">
                          {f.status === 'candidate' && (
                            <>
                              <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => handleFactAction(f.id, 'approved', 'enrichment')} disabled={action.isPending}>{t('orxControl.factActions.approve')}</Button>
                              <Button size="sm" variant="outline" className="h-5 text-[10px] px-2 text-destructive" onClick={() => handleFactAction(f.id, 'rejected', 'enrichment')} disabled={action.isPending}>{t('orxControl.factActions.reject')}</Button>
                            </>
                          )}
                          {f.status === 'approved' && <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => handleFactAction(f.id, 'published', 'enrichment')} disabled={action.isPending}>{t('orxControl.factActions.publish')}</Button>}
                          {f.status === 'published' && <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => handleFactAction(f.id, 'stale', 'enrichment')} disabled={action.isPending}>{t('orxControl.factActions.markStale')}</Button>}
                          {f.status === 'rejected' && <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => handleFactAction(f.id, 'candidate', 'enrichment')} disabled={action.isPending}>{t('orxControl.factActions.reopen')}</Button>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {detail?.dimension_facts?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{t('orxControl.detail.dimensionFacts')} ({detail.dimension_facts.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
                    {detail.dimension_facts.map((f: any) => (
                      <div key={f.id} className="border rounded-lg p-2.5 text-xs space-y-1.5 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{f.fact_family} / {f.fact_key}</span>
                          <StatusBadge status={f.status} />
                        </div>
                        {f.display_text && <p className="text-muted-foreground text-[10px] line-clamp-2">{f.display_text}</p>}
                        <div className="flex gap-1 pt-0.5">
                          {f.status === 'candidate' && (
                            <>
                              <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => handleFactAction(f.id, 'internal_approved', 'dimension')} disabled={action.isPending}>{t('orxControl.factActions.approve')}</Button>
                              <Button size="sm" variant="outline" className="h-5 text-[10px] px-2 text-destructive" onClick={() => handleFactAction(f.id, 'rejected', 'dimension')} disabled={action.isPending}>{t('orxControl.factActions.reject')}</Button>
                            </>
                          )}
                          {f.status === 'internal_approved' && <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => handleFactAction(f.id, 'published', 'dimension')} disabled={action.isPending}>{t('orxControl.factActions.publish')}</Button>}
                          {f.status === 'published' && <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => handleFactAction(f.id, 'stale', 'dimension')} disabled={action.isPending}>{t('orxControl.factActions.markStale')}</Button>}
                          {f.status === 'rejected' && <Button size="sm" variant="outline" className="h-5 text-[10px] px-2" onClick={() => handleFactAction(f.id, 'candidate', 'dimension')} disabled={action.isPending}>{t('orxControl.factActions.reopen')}</Button>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {detail?.recent_evidence?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{t('orxControl.detail.recentEvidence')} ({detail.recent_evidence.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2 max-h-[250px] overflow-y-auto">
                    {detail.recent_evidence.map((e: any) => (
                      <div key={e.id} className="border rounded-lg p-2.5 text-xs space-y-0.5 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{e.signal_family}</span>
                          <span className={`text-[10px] font-medium ${e.trust_level === 'high' ? 'text-emerald-600 dark:text-emerald-400' : e.trust_level === 'medium' ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
                            {e.trust_level} {t('orxControl.detail.trust')}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{e.source_type} · {e.source_domain}</div>
                        {e.source_url && (
                          <a href={e.source_url} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline truncate block">{e.source_url}</a>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Button variant="outline" size="sm" className="w-full" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 me-2" /> {t('orxControl.entity.refreshEntity')}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Sort types ──
type SortKey = 'progress_percent' | 'score' | 'confidence' | 'updated_at' | 'evidence_count' | 'entity_name' | 'crawl_status';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />;
  return dir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
}

// ── Main Page ──
export default function OrxControlPanel() {
  const { t } = useTranslation('common');
  const { data: summaryData, isLoading: summLoading, error: summError, refetch: refetchSummary } = useOrxSummary();
  const { data: entitiesData, isLoading: entLoading, error: entError, refetch: refetchEntities } = useOrxEntities();
  const crawlAction = useOrxAction();
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterExposure, setFilterExposure] = useState<string>('all');
  const [filterCrawl, setFilterCrawl] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('progress_percent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const entities: OrxEntity[] = entitiesData?.entities || [];

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleCrawlAction = async (actionName: string, params: any) => {
    try {
      await crawlAction.mutateAsync({ action: actionName, ...params });
      toast.success(t('orxControl.toast.actionExecuted', { action: actionName.replace('crawl-', '') }));
    } catch (e: any) {
      toast.error(e?.message || t('orxControl.toast.actionFailed'));
    }
  };

  const filtered = useMemo(() => {
    let list = [...entities];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.entity_name?.toLowerCase().includes(q) || e.entity_id.toLowerCase().includes(q));
    }
    if (filterType !== 'all') list = list.filter(e => e.entity_type === filterType);
    if (filterStatus !== 'all') list = list.filter(e => e.status === filterStatus);
    if (filterExposure !== 'all') list = list.filter(e => e.exposure_status === filterExposure);
    if (filterCrawl !== 'all') list = list.filter(e => e.crawl_status === filterCrawl);
    list.sort((a, b) => {
      let av: any = (a as any)[sortKey];
      let bv: any = (b as any)[sortKey];
      if (av == null) av = sortDir === 'desc' ? -Infinity : Infinity;
      if (bv == null) bv = sortDir === 'desc' ? -Infinity : Infinity;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [entities, search, filterType, filterStatus, filterExposure, filterCrawl, sortKey, sortDir]);

  const reload = () => { refetchSummary(); refetchEntities(); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            {t('orxControl.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('orxControl.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={summLoading || entLoading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${(summLoading || entLoading) ? 'animate-spin' : ''}`} />
          {t('orxControl.refresh')}
        </Button>
      </div>

      {/* Crawl Queue Strip */}
      <CrawlQueueStrip stats={summaryData?.crawl_stats} loading={summLoading} t={t} />

      {/* Summary Cards */}
      <SummaryCards summary={summaryData?.summary} loading={summLoading} error={summError} t={t} />

      {/* Entities Error */}
      {entError && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-5">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">{t('orxControl.entity.failedToLoad')}</span>
          </div>
          <p className="text-xs text-destructive/70 mt-1">{(entError as Error).message}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('orxControl.entity.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="ps-8 h-9" />
        </div>
        <Select value={filterCrawl} onValueChange={setFilterCrawl}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('orxControl.entity.allCrawl')}</SelectItem>
            {['idle', 'queued', 'running', 'paused', 'completed', 'failed'].map(s => (
              <SelectItem key={s} value={s}>{t(`orxControl.crawl.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterExposure} onValueChange={setFilterExposure}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('orxControl.entity.allExposure')}</SelectItem>
            <SelectItem value="internal_only">{t('orxControl.entity.internalOnly')}</SelectItem>
            <SelectItem value="beta_candidate">{t('orxControl.summary.betaCandidate')}</SelectItem>
            <SelectItem value="beta_approved">{t('orxControl.summary.betaApproved')}</SelectItem>
            <SelectItem value="blocked_missing_layer">{t('orxControl.summary.blockedLayer')}</SelectItem>
            <SelectItem value="blocked_low_confidence">{t('orxControl.summary.blockedConf')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('orxControl.entity.allStatus')}</SelectItem>
            <SelectItem value="scored">{t('orxControl.summary.scored')}</SelectItem>
            <SelectItem value="evaluating">{t('orxControl.summary.evaluating')}</SelectItem>
            <SelectItem value="insufficient">{t('orxControl.summary.insufficient')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('orxControl.entity.allTypes')}</SelectItem>
            <SelectItem value="university">{t('orxControl.entity.university')}</SelectItem>
            <SelectItem value="program">{t('orxControl.entity.program')}</SelectItem>
            <SelectItem value="country">{t('orxControl.entity.country')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Entities Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {entLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">{t('orxControl.entity.loading')}</span>
            </div>
          ) : !entError && filtered.length === 0 && entities.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground">{t('orxControl.entity.noEntities')}</p>
            </div>
          ) : !entError && filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {t('orxControl.entity.noMatch')} ({entities.length} {t('orxControl.entity.totalExist')})
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {([
                      ['entity_name', 'entity', 'text-start'],
                      [null, 'status', 'text-start'],
                      ['crawl_status', 'crawl', 'text-start'],
                      ['progress_percent', 'progress', 'text-start'],
                      ['score', 'score', 'text-end'],
                      ['confidence', 'confidence', 'text-end'],
                      ['evidence_count', 'evidence', 'text-end'],
                      [null, 'facts', 'text-end'],
                      [null, 'actions', 'text-start'],
                    ] as const).map(([sortable, label, align], idx) => (
                      <th
                        key={label}
                        className={`${align} px-3 py-2.5 font-semibold text-xs text-muted-foreground ${sortable ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
                        onClick={sortable ? () => toggleSort(sortable as SortKey) : undefined}
                      >
                        <div className={`flex items-center gap-1 ${align === 'text-end' ? 'justify-end' : ''}`}>
                          {t(`orxControl.table.${label}`)}
                          {sortable && <SortIcon active={sortKey === sortable} dir={sortDir} />}
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b hover:bg-muted/20 cursor-pointer transition-colors group"
                      onClick={() => setSelectedEntity(e.entity_id)}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <EntityIcon type={e.entity_type} />
                          <div>
                            <p className="font-medium text-xs truncate max-w-[200px]">{e.entity_name}</p>
                            {e.country_code && <span className="text-[10px] text-muted-foreground">{e.country_code}</span>}
                            <NeedsAttention entity={e} t={t} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-1">
                          <StatusBadge status={e.status} />
                          <br />
                          <ExposureBadge status={e.exposure_status} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <CrawlStatusBadge status={e.crawl_status} t={t} />
                        {e.crawl_stage && e.crawl_status === 'running' && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5">{e.crawl_stage}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><ProgressBar value={e.progress_percent} /></td>
                      <td className="px-3 py-2.5 text-end font-mono text-xs tabular-nums">{e.score ?? '—'}</td>
                      <td className="px-3 py-2.5 text-end font-mono text-xs tabular-nums">{e.confidence ?? '—'}</td>
                      <td className="px-3 py-2.5 text-end font-mono text-xs tabular-nums">{e.evidence_count}</td>
                      <td className="px-3 py-2.5 text-end font-mono text-xs tabular-nums">
                        <span className="text-emerald-600 dark:text-emerald-400">{e.published_facts_count}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-amber-600 dark:text-amber-400">{e.candidate_facts_count}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-blue-600 dark:text-blue-400">{e.approved_facts_count}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <InlineCrawlActions entity={e} onAction={handleCrawlAction} t={t} />
                      </td>
                      <td className="px-3 py-2.5">
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      {selectedEntity && (
        <EntityDetailDrawer entityId={selectedEntity} onClose={() => setSelectedEntity(null)} t={t} />
      )}
    </div>
  );
}
