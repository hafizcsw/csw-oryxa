import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Play, Pause, Square, RefreshCw, Download, Search,
  CheckCircle, XCircle, AlertTriangle, Globe, Loader2, Plus, ExternalLink, ShieldCheck
} from "lucide-react";

interface Job {
  id: string;
  status: string;
  filter_criteria: any;
  total_rows: number;
  processed_rows: number;
  matched_rows: number;
  review_rows: number;
  failed_rows: number;
  skipped_rows: number;
  batch_size: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  error_summary: string | null;
  trace_id: string;
}

interface EnrichmentRow {
  id: string;
  university_id: string;
  university_name: string;
  country_code: string | null;
  city: string | null;
  official_website_url: string | null;
  official_website_domain: string | null;
  match_source: string | null;
  confidence_score: number | null;
  match_reason: string | null;
  matched_entity_name: string | null;
  enrichment_status: string;
  needs_manual_review: boolean;
  provider_candidates: any;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  review_action: string | null;
  enriched_at: string | null;
}

interface PreflightResult {
  can_start: boolean;
  blockers: string[];
  target_count: number;
  total_available?: number;
  max_rows?: number | null;
  providers_enabled: string[];
  providers_status: Record<string, boolean>;
  active_jobs: any[];
  batch_size: number;
}

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-muted text-muted-foreground',
  running: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  paused: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
  completed: 'bg-green-500/20 text-green-700 dark:text-green-300',
  failed: 'bg-destructive/20 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const ENRICHMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  matched: 'bg-green-500/20 text-green-700',
  review: 'bg-yellow-500/20 text-yellow-700',
  failed: 'bg-destructive/20 text-destructive',
  skipped: 'bg-muted text-muted-foreground',
  approved: 'bg-green-500/20 text-green-700',
  rejected: 'bg-destructive/20 text-destructive',
};

export default function WebsiteEnrichmentPage() {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [reviewRows, setReviewRows] = useState<EnrichmentRow[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Job creation
  const [creating, setCreating] = useState(false);

  // Preflight
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [preflightLoading, setPreflightLoading] = useState(false);

  // Review
  const [reviewFilter, setReviewFilter] = useState("review");
  const [reviewSearch, setReviewSearch] = useState("");

  // Apply state
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [applyProgress, setApplyProgress] = useState("");

  // Batch control
  const [batchLimit, setBatchLimit] = useState<number | null>(100);
  const [allAvailableCount, setAllAvailableCount] = useState<number | null>(null);

  const callOrchestrator = useCallback(async (body: any) => {
    const { data, error } = await supabase.functions.invoke('website-enrich-orchestrator', { body });
    if (error) throw error;
    return data;
  }, []);

  const cleanupOnceRef = useRef(false);
  const cleanupLockRef = useRef(false);

  const runCleanup = useCallback(async (jobId?: string) => {
    if (cleanupLockRef.current) return;
    cleanupLockRef.current = true;
    try {
      await callOrchestrator({ action: 'cleanup_existing', ...(jobId ? { job_id: jobId } : {}) });
    } catch (err) {
      console.warn('[WE-Cleanup] skip cleanup error:', err);
    } finally {
      cleanupLockRef.current = false;
    }
  }, [callOrchestrator]);

  const fetchJobs = useCallback(async () => {
    try {
      if (!cleanupOnceRef.current) {
        cleanupOnceRef.current = true;
        await runCleanup();
      }

      const [statusData, preflightData] = await Promise.all([
        callOrchestrator({ action: 'status' }),
        callOrchestrator({ action: 'preflight', filter: {}, batch_size: 20 }),
      ]);

      setJobs(statusData.jobs || []);
      setAllAvailableCount(preflightData.total_available ?? preflightData.target_count ?? null);
    } catch (err: any) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setLoading(false);
    }
  }, [callOrchestrator, runCleanup]);

  const fetchReviewRows = useCallback(async (jobId: string) => {
    setReviewLoading(true);
    try {
      await runCleanup(jobId);

      let query = supabase
        .from('website_enrichment_rows')
        .select('*')
        .eq('job_id', jobId)
        .order('confidence_score', { ascending: true, nullsFirst: true })
        .limit(100);

      if (reviewFilter !== 'all') {
        query = query.eq('enrichment_status', reviewFilter);
      }
      if (reviewSearch) {
        query = query.ilike('university_name', `%${reviewSearch}%`);
      }

      const { data } = await query;
      const rows = data || [];

      if (rows.length === 0) {
        setReviewRows([]);
        return;
      }

      const uniIds = [...new Set(rows.map(r => r.university_id))];
      const { data: withWebsite } = await supabase
        .from('universities')
        .select('id')
        .in('id', uniIds)
        .not('website', 'is', null)
        .neq('website', '');

      const withWebsiteSet = new Set((withWebsite || []).map(u => u.id));
      setReviewRows(rows.filter(r => !withWebsiteSet.has(r.university_id)));
    } catch (err) {
      console.error("Failed to fetch review rows:", err);
    } finally {
      setReviewLoading(false);
    }
  }, [reviewFilter, reviewSearch, runCleanup]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10_000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // Auto-tick: call orchestrator tick every 5s while a job is running
  useEffect(() => {
    const runningJob = jobs.find(j => j.status === 'running');
    if (!runningJob) return;
    const iv = setInterval(() => {
      callOrchestrator({ action: 'tick', job_id: runningJob.id }).catch(() => {});
    }, 5_000);
    return () => clearInterval(iv);
  }, [jobs, callOrchestrator]);

  useEffect(() => {
    if (selectedJob) fetchReviewRows(selectedJob);
  }, [selectedJob, fetchReviewRows]);

  // === Full Crawl: preflight → confirm → create + auto-start ===
  const runPreflight = async () => {
    setPreflightLoading(true);
    try {
      const filter: any = {};
      if (batchLimit) filter.max_rows = batchLimit;

      const data = await callOrchestrator({
        action: 'preflight',
        filter,
        batch_size: 20,
      });

      console.log('[WE-Preflight] Response:', JSON.stringify(data));
      setPreflightResult(data);
      setShowConfirmDialog(true);
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setPreflightLoading(false);
    }
  };

  const confirmCreateJob = async () => {
    setShowConfirmDialog(false);
    setCreating(true);
    try {
      const filter: any = {};
      if (batchLimit) filter.max_rows = batchLimit;

      const data = await callOrchestrator({
        action: 'create',
        filter,
        batch_size: 20,
      });

      if (data.ok === false && data.error === 'active_job_exists') {
        toast({
          title: 'يوجد مهمة نشطة بالفعل',
          description: data.message,
          variant: "destructive",
        });
      } else if (data.job?.id) {
        // Auto-start immediately after creation
        await callOrchestrator({ action: 'start', job_id: data.job.id });
        toast({ title: 'تم بدء الزحف الكامل', description: `المهمة: ${data.job.id.slice(0, 8)}` });
        fetchJobs();
      }
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const jobAction = async (jobId: string, action: string) => {
    try {
      await callOrchestrator({ action, job_id: jobId });
      toast({ title: t(`admin.websiteEnrich.${action}Success`) });
      fetchJobs();
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const applyApproved = async (jobId: string, forceOverwrite = false, includeReview = false) => {
    if (applyingJobId) return;
    setApplyingJobId(jobId);
    setApplyProgress(`جاري النشر${includeReview ? ' (يشمل الضعيف)' : ''}... يعمل في الخلفية على السيرفر`);

    try {
      const data = await callOrchestrator({
        action: 'apply_approved',
        job_id: jobId,
        force_overwrite: forceOverwrite,
        include_review: includeReview,
        run_all: true,
        batch_size: includeReview ? 60 : 200,
      });

      const totalApplied = (data?.applied || 0) + (data?.partial_applied || 0);
      const totalSkipped = data?.skipped || 0;

      if (data?.done) {
        toast({
          title: includeReview ? "✅ تم نشر كل النتائج (يشمل الضعيف)" : "✅ تم تطبيق المطابقات",
          description: `إجمالي المطبق: ${totalApplied} | تخطي: ${totalSkipped}`,
        });
      } else {
        // Partial completion (hit server iteration limit), auto-continue
        toast({
          title: "⏳ تم نشر دفعة كبيرة، جاري المتابعة...",
          description: `تم: ${totalApplied} | تخطي: ${totalSkipped} | متبقي: ${data?.remaining || '?'}`,
        });
        // Continue remaining in background
        setApplyingJobId(null);
        setApplyProgress("");
        fetchJobs();
        applyApproved(jobId, forceOverwrite, includeReview);
        return;
      }
    } catch (err: any) {
      toast({
        title: "خطأ أثناء التطبيق",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setApplyingJobId(null);
      setApplyProgress("");
      fetchJobs();
    }
  };

  const reviewRow = async (rowId: string, action: string, note?: string, editedUrl?: string) => {
    try {
      const updateData: any = {
        review_action: action,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
        enrichment_status: action === 'approve' ? 'approved'
          : action === 'reject' || action === 'no_website' ? 'rejected'
          : 'approved',
        needs_manual_review: false,
      };

      if (action === 'edit' && editedUrl) {
        updateData.official_website_url = editedUrl;
        updateData.official_website_domain = editedUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        updateData.match_source = 'manual';
        updateData.confidence_score = 100;
        updateData.enrichment_status = 'approved';
      }

      await supabase.from('website_enrichment_rows').update(updateData).eq('id', rowId);
      if (selectedJob) fetchReviewRows(selectedJob);
      toast({ title: t("admin.websiteEnrich.reviewSaved") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const exportCsv = async (jobId: string, filterStatus?: string) => {
    try {
      let query = supabase
        .from('website_enrichment_rows')
        .select('university_id, university_name, country_code, city, official_website_url, official_website_domain, match_source, confidence_score, enrichment_status, needs_manual_review, match_reason, matched_entity_name')
        .eq('job_id', jobId);

      if (filterStatus && filterStatus !== 'all') {
        query = query.eq('enrichment_status', filterStatus);
      }

      const { data } = await query;
      if (!data || data.length === 0) return;

      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${(row as any)[h] ?? ''}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `website_enrichment_${jobId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: t("admin.websiteEnrich.exported") });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  };

  const hasActiveJobs = jobs.some(j => ['queued', 'running', 'paused'].includes(j.status));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("admin.websiteEnrich.title")}</h1>

      {/* Preflight Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              تأكيد بدء الزحف الكامل
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {preflightResult && (
                  <>
                    {(preflightResult.blockers?.length ?? 0) > 0 && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                        <p className="font-medium text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" /> موانع:
                        </p>
                        <ul className="list-disc list-inside mt-1">
                          {preflightResult.blockers.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-muted-foreground">عدد الجامعات المستهدفة:</span> <strong>{preflightResult.target_count ?? 0}</strong></div>
                      <div><span className="text-muted-foreground">حجم الدفعة:</span> <strong>{preflightResult.batch_size ?? 20}</strong></div>
                         <div><span className="text-muted-foreground">مزودات البيانات:</span> <strong>{(preflightResult.providers_enabled ?? []).join(', ') || 'OpenAlex → ROR → Wikidata'}</strong></div>
                         <div><span className="text-muted-foreground">الحقول المستهدفة:</span> <strong>الموقع الرسمي + المدينة + الدولة</strong></div>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCreateJob}
              disabled={(preflightResult?.blockers?.length ?? 0) > 0}
            >
              تأكيد وبدء الزحف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="jobs" className="w-full">
        <TabsList>
          <TabsTrigger value="jobs">{t("admin.websiteEnrich.tabs.jobs")}</TabsTrigger>
          <TabsTrigger value="review">{t("admin.websiteEnrich.tabs.review")}</TabsTrigger>
        </TabsList>

        {/* === JOBS TAB === */}
        <TabsContent value="jobs" className="space-y-4">
          {/* Batch control + Start Button */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium whitespace-nowrap">حجم الدفعة:</label>
                <Select value={String(batchLimit || 'all')} onValueChange={v => setBatchLimit(v === 'all' ? null : Number(v))}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">أول 50 جامعة</SelectItem>
                    <SelectItem value="100">أول 100 جامعة</SelectItem>
                    <SelectItem value="500">أول 500 جامعة</SelectItem>
                    <SelectItem value="1000">أول 1,000 جامعة</SelectItem>
                    <SelectItem value="all">الكل ({allAvailableCount !== null ? allAvailableCount.toLocaleString() : '...'})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="lg"
                className="w-full text-lg py-6"
                onClick={runPreflight}
                disabled={creating || preflightLoading || hasActiveJobs}
              >
                {preflightLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Globe className="h-5 w-5 mr-2" />}
                {creating ? 'جارٍ الإنشاء...' : hasActiveJobs ? 'يوجد مهمة نشطة بالفعل' : `بدء الإثراء${batchLimit ? ` (${batchLimit} جامعة)` : ' الكامل'}`}
              </Button>
              <p className="text-xs text-muted-foreground">
                العدد الحالي الفعلي للجامعات النشطة بدون موقع: <strong>{allAvailableCount !== null ? allAvailableCount.toLocaleString() : '...'}</strong>
              </p>
            </CardContent>
          </Card>

          {/* Jobs list */}
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => {
                const actualProcessed = job.matched_rows + job.review_rows + job.failed_rows + job.skipped_rows;
                const progress = job.total_rows > 0
                  ? Math.round((actualProcessed / job.total_rows) * 100)
                  : 0;

                // Calculate speed & ETA
                const startedAt = job.started_at ? new Date(job.started_at).getTime() : null;
                const lastActivity = job.last_activity_at ? new Date(job.last_activity_at).getTime() : null;
                const elapsedMs = startedAt ? (lastActivity || Date.now()) - startedAt : 0;
                const elapsedMin = elapsedMs / 60_000;
                const speed = elapsedMin > 0.1 ? Math.round(actualProcessed / elapsedMin) : 0;
                const remaining = job.total_rows - actualProcessed;
                const etaMin = speed > 0 ? Math.round(remaining / speed) : null;

                const formatDuration = (mins: number) => {
                  if (mins < 1) return 'أقل من دقيقة';
                  if (mins < 60) return `${mins} د`;
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  return `${h} س ${m > 0 ? `${m} د` : ''}`;
                };

                return (
                  <Card key={job.id} className={`cursor-pointer transition-colors ${selectedJob === job.id ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setSelectedJob(job.id)}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{job.trace_id || job.id.slice(0, 8)}</span>
                          <Badge className={STATUS_COLORS[job.status]}>{job.status}</Badge>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {job.status === 'queued' && (
                            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 text-white" onClick={e => { e.stopPropagation(); jobAction(job.id, 'start'); }}>
                              <Play className="h-3 w-3 mr-1" />
                              بدء الزحف
                            </Button>
                          )}
                          {job.status === 'running' && (
                            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); jobAction(job.id, 'pause'); }}>
                              <Pause className="h-3 w-3 mr-1" />
                              إيقاف مؤقت
                            </Button>
                          )}
                          {job.status === 'paused' && (
                            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 text-white" onClick={e => { e.stopPropagation(); jobAction(job.id, 'resume'); }}>
                              <Play className="h-3 w-3 mr-1" />
                              استئناف
                            </Button>
                          )}
                          {['queued', 'running', 'paused'].includes(job.status) && (
                            <Button size="sm" variant="destructive" onClick={e => { e.stopPropagation(); jobAction(job.id, 'cancel'); }}>
                              <Square className="h-3 w-3 mr-1" />
                              إلغاء
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); exportCsv(job.id); }}>
                            <Download className="h-3 w-3 mr-1" />
                            تصدير
                          </Button>
                          {job.status === 'completed' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                disabled={applyingJobId === job.id}
                                onClick={e => { e.stopPropagation(); applyApproved(job.id, false, false); }}
                              >
                                {applyingJobId === job.id ? (
                                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" />{applyProgress || "جاري التطبيق..."}</>
                                ) : (
                                  <><CheckCircle className="h-3 w-3 mr-1" />{t("admin.websiteEnrich.applyMatched")}</>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={applyingJobId === job.id}
                                onClick={e => { e.stopPropagation(); applyApproved(job.id, true, false); }}
                                title="تحديث المواقع الموجودة أيضاً"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                تطبيق + تحديث الموجود
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={applyingJobId === job.id}
                                onClick={e => { e.stopPropagation(); applyApproved(job.id, true, true); }}
                                title="نشر كل الصفوف (يشمل الضعيف)"
                              >
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                نشر الكل (يشمل الضعيف)
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Progress bar with real percentage */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{actualProcessed} / {job.total_rows} جامعة</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      {/* Speed & ETA row */}
                      {job.status === 'running' && (
                        <div className="flex flex-wrap gap-3 text-xs bg-muted/50 rounded-md px-3 py-1.5">
                          <span>⚡ السرعة: <strong>{speed}</strong> جامعة/د</span>
                          {etaMin !== null && (
                            <span>⏱ المتبقي: <strong>{formatDuration(etaMin)}</strong></span>
                          )}
                          <span>⏳ المنقضي: <strong>{formatDuration(Math.round(elapsedMin))}</strong></span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm">
                        <span>{t("admin.websiteEnrich.total")}: <strong>{job.total_rows}</strong></span>
                        <span className="text-green-600">✓ {job.matched_rows}</span>
                        <span className="text-yellow-600">⚠ {job.review_rows}</span>
                        <span className="text-destructive">✗ {job.failed_rows}</span>
                        <span className="text-muted-foreground">⊘ {job.skipped_rows}</span>
                        <span className="text-muted-foreground">
                          {t("admin.websiteEnrich.lastActivity")}: {job.last_activity_at ? new Date(job.last_activity_at).toLocaleTimeString() : '-'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {jobs.length === 0 && (
                <p className="text-muted-foreground text-center py-8">{t("admin.websiteEnrich.noJobs")}</p>
              )}
            </div>
          )}
        </TabsContent>

        {/* === REVIEW TAB === */}
        <TabsContent value="review" className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <Select value={selectedJob || ''} onValueChange={setSelectedJob}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder={t("admin.websiteEnrich.selectJob")} />
              </SelectTrigger>
              <SelectContent>
                {jobs.map(j => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.trace_id || j.id.slice(0, 8)} — {j.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={reviewFilter} onValueChange={setReviewFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.websiteEnrich.filterAll")}</SelectItem>
                <SelectItem value="review">{t("admin.websiteEnrich.filterReview")}</SelectItem>
                <SelectItem value="matched">{t("admin.websiteEnrich.filterMatched")}</SelectItem>
                <SelectItem value="failed">{t("admin.websiteEnrich.filterFailed")}</SelectItem>
                <SelectItem value="approved">{t("admin.websiteEnrich.filterApproved")}</SelectItem>
                <SelectItem value="rejected">{t("admin.websiteEnrich.filterRejected")}</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.websiteEnrich.searchUni")}
                value={reviewSearch}
                onChange={e => setReviewSearch(e.target.value)}
                className="pl-8 w-60"
              />
            </div>

            <Button variant="outline" onClick={() => selectedJob && fetchReviewRows(selectedJob)}>
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Button variant="outline" onClick={() => selectedJob && exportCsv(selectedJob, reviewFilter)}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>

          {reviewLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>{t("admin.websiteEnrich.university")}</TableHead>
                     <TableHead>{t("admin.websiteEnrich.country")}</TableHead>
                     <TableHead>المدينة المكتشفة</TableHead>
                     <TableHead>الدولة المكتشفة</TableHead>
                     <TableHead>{t("admin.websiteEnrich.candidateUrl")}</TableHead>
                     <TableHead>{t("admin.websiteEnrich.source")}</TableHead>
                     <TableHead>{t("admin.websiteEnrich.confidence")}</TableHead>
                     <TableHead>{t("admin.websiteEnrich.status")}</TableHead>
                     <TableHead>{t("admin.websiteEnrich.actions")}</TableHead>
                    <TableHead>{t("admin.websiteEnrich.status")}</TableHead>
                    <TableHead>{t("admin.websiteEnrich.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewRows.map(row => (
                    <ReviewRowItem key={row.id} row={row} onReview={reviewRow} t={t} />
                  ))}
                  {reviewRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        {t("admin.websiteEnrich.noRows")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReviewRowItem({ row, onReview, t }: {
  row: EnrichmentRow;
  onReview: (id: string, action: string, note?: string, url?: string) => void;
  t: any;
}) {
  const [editUrl, setEditUrl] = useState(row.official_website_url || '');
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
         <TableCell className="font-medium max-w-[200px] truncate">{row.university_name}</TableCell>
         <TableCell>{row.country_code || '-'}</TableCell>
         <TableCell className="text-xs">{(row as any).matched_city || '-'}</TableCell>
         <TableCell className="text-xs">{(row as any).matched_country || '-'}</TableCell>
        <TableCell className="max-w-[200px]">
          {row.official_website_url ? (
            <a href={row.official_website_url} target="_blank" rel="noopener noreferrer"
              className="text-primary underline flex items-center gap-1 truncate"
              onClick={e => e.stopPropagation()}>
              {row.official_website_domain || row.official_website_url}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          ) : '-'}
        </TableCell>
        <TableCell>{row.match_source || '-'}</TableCell>
        <TableCell>
          {row.confidence_score != null ? (
            <span className={row.confidence_score >= 70 ? 'text-green-600' : row.confidence_score >= 40 ? 'text-yellow-600' : 'text-destructive'}>
              {row.confidence_score}%
            </span>
          ) : '-'}
        </TableCell>
        <TableCell>
          <Badge className={ENRICHMENT_STATUS_COLORS[row.enrichment_status] || ''}>
            {row.enrichment_status}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            {row.enrichment_status === 'review' && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onReview(row.id, 'approve')}>
                  <CheckCircle className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onReview(row.id, 'reject')}>
                  <XCircle className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/30 p-4">
            <div className="space-y-3">
              <div className="text-sm space-y-1">
                <p><strong>{t("admin.websiteEnrich.matchReason")}:</strong> {row.match_reason || '-'}</p>
                <p><strong>{t("admin.websiteEnrich.matchedEntity")}:</strong> {row.matched_entity_name || '-'}</p>
              </div>

              {row.provider_candidates && Array.isArray(row.provider_candidates) && (
                <div>
                  <p className="text-sm font-medium mb-1">{t("admin.websiteEnrich.candidates")}:</p>
                  <div className="space-y-1">
                    {row.provider_candidates.map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className={`font-mono ${i === 0 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                          {c.score ?? '-'}
                        </span>
                        <span>{c.name}</span>
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">
                            {c.url}
                          </a>
                        )}
                        {c.raw_url && c.raw_url !== c.url && (
                          <span className="text-muted-foreground text-xs">(raw: {c.raw_url})</span>
                        )}
                        <span className="text-muted-foreground text-xs">{c.country}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground">{t("admin.websiteEnrich.editUrl")}</label>
                  <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-muted-foreground">{t("admin.websiteEnrich.reviewNote")}</label>
                  <Input value={note} onChange={e => setNote(e.target.value)} className="h-8 text-sm" />
                </div>
                <Button size="sm" onClick={() => onReview(row.id, 'edit', note, editUrl)}>
                  {t("admin.websiteEnrich.saveEdit")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReview(row.id, 'approve', note)}>
                  {t("admin.websiteEnrich.approve")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReview(row.id, 'no_website', note)}>
                  {t("admin.websiteEnrich.noWebsite")}
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
