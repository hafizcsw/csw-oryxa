import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings2, Image, Play, Square, CheckCircle2, AlertCircle, Activity, Clock, Layers, Globe, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CrawlActivityFeed } from "./CrawlActivityFeed";
import { Separator } from "@/components/ui/separator";

interface PipelineMetricsData {
  lastTickAt: string | null;
  isStale: boolean;
  mode: string;
  urlsByStatus: Record<string, number>;
  lastMetrics: { metric: string; value: number; created_at: string }[];
  universitiesDiscovered?: number;
  programsDraft?: number;
  catalogCursor?: { key: string; page: number; status: string; last_run_at: string | null } | null;
}

interface CrawlPolicySelectorProps {
  policy: { mode: string; fallback_order?: string[]; logo_source_order?: string[] } | null;
  universitiesWithLogo: number;
  onChanged: () => void;
  pipelineMetrics?: PipelineMetricsData | null;
}

const MODES = ["official", "uniranks", "qs", "hybrid"] as const;

type BulkState = "idle" | "creating" | "running" | "done" | "error";

export function CrawlPolicySelector({ policy, universitiesWithLogo, onChanged, pipelineMetrics }: CrawlPolicySelectorProps) {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [bulkState, setBulkState] = useState<BulkState>("idle");
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState({ total: 0, discovered: 0, extracted: 0, published: 0 });
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentMode = policy?.mode || "official";

  useEffect(() => { checkActiveBatch(); }, []);

  useEffect(() => {
    if (bulkState === "running" && activeBatchId) {
      pollRef.current = setInterval(() => pollBatchProgress(activeBatchId), 5000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [bulkState, activeBatchId]);

  const checkActiveBatch = useCallback(async () => {
    const { data } = await supabase
      .from("crawl_batches")
      .select("id, status, universities_count, programs_extracted, programs_published")
      .in("status", ["pending", "websites", "discovery", "fetching", "extracting", "verifying"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setActiveBatchId(data.id);
      setBatchProgress({
        total: data.universities_count || 0,
        discovered: 0,
        extracted: data.programs_extracted || 0,
        published: data.programs_published || 0,
      });
      setBulkState("running");
      pollBatchProgress(data.id);
    }
  }, []);

  const pollBatchProgress = async (batchId: string) => {
    const { data: batch } = await supabase
      .from("crawl_batches")
      .select("id, status, universities_count, programs_discovered, programs_extracted, programs_published, finished_at")
      .eq("id", batchId)
      .single();

    if (!batch) return;

    setBatchProgress({
      total: batch.universities_count || 0,
      discovered: batch.programs_discovered || 0,
      extracted: batch.programs_extracted || 0,
      published: batch.programs_published || 0,
    });

    if (batch.finished_at || batch.status === "done" || batch.status === "finished") {
      setBulkState("done");
      if (pollRef.current) clearInterval(pollRef.current);
      onChanged();
      toast({
        title: t("admin.crawl.policy.crawlComplete"),
        description: t("admin.crawl.policy.crawlCompleteDesc", {
          unis: batch.universities_count || 0,
          published: batch.programs_published || 0,
        }),
      });
    }
  };

  const handleModeChange = async (mode: string) => {
    setSaving(true);
    try {
      await api("/admin-crawl-set-policy", {
        method: "POST",
        body: { policy: { ...(policy || {}), mode } },
      });
      onChanged();
      toast({
        title: t("admin.crawl.policy.sourceUpdated"),
        description: t("admin.crawl.policy.newMode", { mode: t(`admin.crawl.policy.modes.${mode}`) }),
      });
    } catch (err: any) {
      toast({ title: t("common.error", "Error"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStartBulkCrawl = async () => {
    setBulkState("creating");
    setErrorMsg("");
    try {
      const result = await api("/admin-crawl-start-bulk", {
        method: "POST",
        body: { mode: currentMode },
        timeout: 30000,
      });

      setActiveBatchId(result.batch_id);
      setBatchProgress({ total: result.universities_count, discovered: 0, extracted: 0, published: 0 });
      setBulkState("running");
      toast({
        title: t("admin.crawl.policy.bulkStarted"),
        description: t("admin.crawl.policy.bulkStartedDesc", {
          count: result.universities_count,
          mode: t(`admin.crawl.policy.modes.${result.mode}`),
        }),
      });
      onChanged();
    } catch (err: any) {
      let parsed: any = null;
      try { parsed = JSON.parse(err.message); } catch { /* not JSON */ }

      if (parsed?.error === "batch_already_active" && parsed?.active_batch_id) {
        setActiveBatchId(parsed.active_batch_id);
        setBatchProgress({ total: parsed.universities_count || 0, discovered: 0, extracted: 0, published: 0 });
        setBulkState("running");
        pollBatchProgress(parsed.active_batch_id);
        toast({
          title: t("admin.crawl.policy.batchAlreadyActive"),
          description: t("admin.crawl.policy.batchProcessing", { id: parsed.active_batch_id?.slice(0, 8) }),
        });
        return;
      }

      setBulkState("error");
      setErrorMsg(parsed?.error || err.message);
      toast({ title: t("common.error"), description: parsed?.error || err.message, variant: "destructive" });
    }
  };

  const handleStopBatch = async () => {
    if (!activeBatchId) return;
    try {
      const result = await api("/admin-crawl-stop-batch", {
        method: "POST",
        body: { batch_id: activeBatchId },
      });
      if (!result.ok && !result.already_stopped) {
        throw new Error(result.error || "stop_failed");
      }
      setBulkState("idle");
      setActiveBatchId(null);
      if (pollRef.current) clearInterval(pollRef.current);
      toast({ title: t("admin.crawl.policy.batchStopped") });
      onChanged();
    } catch (err: any) {
      toast({ title: t("common.error", "Error"), description: err.message, variant: "destructive" });
    }
  };

  const progressPercent = batchProgress.discovered > 0
    ? Math.min(Math.round((batchProgress.extracted / batchProgress.discovered) * 100), 100)
    : 0;

  // Compute throughput from last metrics (sum of key counters)
  const throughput10m = pipelineMetrics?.lastMetrics
    ?.filter(m => ["pages_fetched", "programs_extracted", "urls_seeded", "published"].includes(m.metric))
    .reduce((sum, m) => sum + m.value, 0) ?? 0;

  const urlsByStatus = pipelineMetrics?.urlsByStatus ?? {};
  const backlogTotal = Object.values(urlsByStatus).reduce((s, v) => s + v, 0);

  const tickAge = pipelineMetrics?.lastTickAt
    ? Math.round((Date.now() - new Date(pipelineMetrics.lastTickAt).getTime()) / 1000)
    : null;

  const tickAgeLabel = tickAge !== null
    ? tickAge < 60 ? `${tickAge}s ago` : `${Math.round(tickAge / 60)}m ago`
    : t("admin.crawl.never");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          {t("admin.crawl.policy.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Always-On Pipeline Status Panel */}
        {pipelineMetrics && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className={`h-4 w-4 ${pipelineMetrics.isStale ? 'text-yellow-500' : 'text-green-500'}`} />
                <span className="text-sm font-medium">{t("admin.crawl.policy.pipelineStatus")}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${pipelineMetrics.isStale ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                  {pipelineMetrics.isStale ? t("admin.crawl.policy.stale") : t("admin.crawl.policy.alwaysOn")}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {t(`admin.crawl.policy.modes.${currentMode}`)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{t("admin.crawl.policy.lastTickAgo")}:</span>
                <span className="font-medium">{tickAgeLabel}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{t("admin.crawl.policy.throughput")}:</span>
                <span className="font-medium">{throughput10m}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{t("admin.crawl.policy.backlog")}:</span>
                <span className="font-medium">{backlogTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Universities Discovered + Programs Extracted */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{t("admin.crawl.policy.universitiesDiscovered")}:</span>
                <span className="font-medium">{(pipelineMetrics.universitiesDiscovered ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{t("admin.crawl.policy.programsExtracted")}:</span>
                <span className="font-medium">{(pipelineMetrics.programsDraft ?? 0).toLocaleString()}</span>
              </div>
              {pipelineMetrics.catalogCursor && (
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("admin.crawl.policy.catalogPage")}:</span>
                  <span className="font-medium">{pipelineMetrics.catalogCursor.page} ({pipelineMetrics.catalogCursor.status})</span>
                </div>
              )}
            </div>

            {/* Backlog breakdown */}
            {backlogTotal > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(urlsByStatus).filter(([, v]) => v > 0).map(([status, count]) => (
                  <span key={status} className="bg-muted rounded px-1.5 py-0.5">
                    {status}: <strong>{count.toLocaleString()}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 1: Source Mode Selection */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium">{t("admin.crawl.policy.sourceLabel")}</p>
            <p className="text-xs text-muted-foreground">
              {t("admin.crawl.policy.sourceHint")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Select value={currentMode} onValueChange={handleModeChange} disabled={saving || bulkState === "running" || bulkState === "creating"}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`admin.crawl.policy.modes.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logo count info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Image className="h-4 w-4" />
          <span>{t("admin.crawl.policy.logosLinked")}: <strong className="text-foreground">{universitiesWithLogo.toLocaleString()}</strong></span>
        </div>

        <Separator />

        {/* Section 2: Boost Crawl (optional) */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium">{t("admin.crawl.policy.bulkCrawlLabel")}</p>
            <p className="text-xs text-muted-foreground">
              {t("admin.crawl.policy.bulkCrawlHint")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {bulkState === "running" ? (
              <Button size="sm" variant="destructive" onClick={handleStopBatch}>
                <Square className="h-4 w-4 mr-1" />
                {t("admin.crawl.policy.stopBatch")}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleStartBulkCrawl}
                disabled={bulkState === "creating" || saving}
              >
                {bulkState === "creating" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {t("admin.crawl.policy.boostCrawl")}
              </Button>
            )}
          </div>
        </div>

        {/* Progress when running */}
        {(bulkState === "running" || bulkState === "creating") && (
          <>
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Progress value={bulkState === "creating" ? undefined : progressPercent} className="h-2.5" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>🏫 {t("admin.crawl.policy.universities")}: {batchProgress.total}</span>
                  <span>🔍 {t("admin.crawl.policy.programsDiscovered", "Discovered")}: {batchProgress.discovered}</span>
                  <span>📚 {t("admin.crawl.policy.programsExtracted")}: {batchProgress.extracted}</span>
                  <span>✅ {t("admin.crawl.policy.programsPublished")}: {batchProgress.published}</span>
                </div>
                <span>{progressPercent}%</span>
              </div>
              {activeBatchId && (
                <p className="text-xs text-muted-foreground">
                  {t("admin.crawl.policy.batchId")}: {activeBatchId.slice(0, 8)}… — {t("admin.crawl.policy.autoProcessing")}
                </p>
              )}
            </div>
            <CrawlActivityFeed batchId={activeBatchId} isActive={true} />
          </>
        )}

        {/* Done state */}
        {bulkState === "done" && (
          <div className="flex items-center gap-2 text-sm text-primary animate-in fade-in duration-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>{t("admin.crawl.policy.crawlDone", { programs: batchProgress.extracted })}</span>
            <Button size="sm" variant="ghost" onClick={() => setBulkState("idle")} className="ml-auto">
              {t("admin.crawl.policy.close")}
            </Button>
          </div>
        )}

        {/* Error state */}
        {bulkState === "error" && (
          <div className="flex items-center gap-2 text-sm text-destructive animate-in fade-in duration-300">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMsg}</span>
            <Button size="sm" variant="ghost" onClick={() => setBulkState("idle")} className="ml-auto">
              {t("admin.crawl.policy.close")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
