import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, Pause, Square, Eye, Check, X, MapPin, Building2, Home, AlertTriangle, Shield, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";

// ── Types ──
interface Job {
  id: string;
  status: string;
  total_count: number;
  processed_count: number;
  verified_count: number;
  flagged_count: number;
  unverifiable_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  metrics: any;
}

interface VerificationRow {
  id: string;
  job_id: string;
  university_id: string;
  university_name: string;
  current_country_code: string;
  current_city: string;
  resolved_country_code: string | null;
  resolved_city: string | null;
  resolved_address: string | null;
  resolved_lat: number | null;
  resolved_lon: number | null;
  country_match: boolean;
  city_match: boolean;
  confidence: number;
  issues: string[];
  status: string;
  resolution_source: string;
  raw_data: any;
  trace_id: string | null;
  locked_at: string | null;
  processed_at: string | null;
}

interface Evidence {
  id: string;
  source_type: string;
  source_url: string;
  entity_type: string;
  entity_scope: string | null;
  detected_country_code: string | null;
  detected_city: string | null;
  detected_address: string | null;
  detected_lat: number | null;
  detected_lon: number | null;
  confidence: number;
  signals: any;
  raw_excerpt: string | null;
  content_hash: string | null;
}

interface LiveStats {
  retryable_count: number;
  jsonld_count: number;
  tld_only_count: number;
  housing_evidence_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  verified: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  flagged: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  unverifiable: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
  rejected: "bg-destructive/5 text-destructive",
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  processing: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

type RunPhase = "idle" | "creating" | "starting" | "running" | "paused" | "completed" | "cancelled" | "error";

const TICK_INTERVAL_MS = 3000;
const PRESETS = [
  { label: "Run 20", value: 20 },
  { label: "Run 100", value: 100 },
  { label: "Run 500", value: 500 },
];

function generateTraceId(prefix = "dash") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ══════════════════════════════════════
// Main Dashboard
// ══════════════════════════════════════
export function GeoVerificationDashboard() {
  const { toast } = useToast();

  // Job state
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actorId, setActorId] = useState<string | null>(null);
  const [customCount, setCustomCount] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveStats>({ retryable_count: 0, jsonld_count: 0, tld_only_count: 0, housing_evidence_count: 0 });
  const [tickCount, setTickCount] = useState(0);
  const [runLog, setRunLog] = useState<string[]>([]);

  // Force-publish dialog
  const [forceTarget, setForceTarget] = useState<VerificationRow | null>(null);
  const [forceReason, setForceReason] = useState("");
  const [forceLat, setForceLat] = useState("");
  const [forceLon, setForceLon] = useState("");
  const [forceLoading, setForceLoading] = useState(false);

  // Auto-tick control
  const autoTickRef = useRef(false);
  const loopRunningRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("ar-EG");
    setRunLog(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  // Get actor ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setActorId(data.user.id);
    });
  }, []);

  // ── On mount: check for existing running job ──
  useEffect(() => {
    (async () => {
      try {
        const res = await api("/geo-verify-orchestrator", { method: "POST", body: { action: "status" } });
        if (res.ok && res.jobs?.length) {
          const running = res.jobs.find((j: Job) => j.status === "running");
          if (running) {
            setActiveJob(running);
            setPhase("paused"); // Show resume option
            addLog(`تم العثور على مهمة قائمة: ${running.id.slice(0, 8)} (${running.processed_count}/${running.total_count})`);
          } else {
            const latest = res.jobs[0];
            setActiveJob(latest);
            if (latest.status === "completed") setPhase("completed");
            else if (latest.status === "cancelled") setPhase("cancelled");
            else setPhase("idle");
          }
        }
      } catch (e) {
        console.error("Init status check failed:", e);
      }
    })();
  }, [addLog]);

  // ── Fetch rows for display ──
  const fetchRows = useCallback(async (jobId: string) => {
    let query = supabase
      .from("geo_verification_rows")
      .select("*")
      .eq("job_id", jobId)
      .order("processed_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query;
    setRows((data as any[]) || []);
  }, [statusFilter]);

  // ── Fetch live stats from rows ──
  const fetchLiveStats = useCallback(async (jobId: string) => {
    try {
      // Retryable (website_unreachable flagged rows)
      const { count: retryable } = await supabase
        .from("geo_verification_rows")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .contains("issues", ["website_unreachable"]);

      // JSON-LD backed
      const { count: jsonld } = await supabase
        .from("geo_verification_rows")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .ilike("resolution_source", "%jsonld%");

      // TLD-only (resolution_source is comma-joined, e.g. "tld" or "tld,footer")
      const { count: tld } = await supabase
        .from("geo_verification_rows")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("resolution_source", "tld");

      // Housing evidence
      const { count: housing } = await supabase
        .from("university_geo_evidence")
        .select("*", { count: "exact", head: true })
        .eq("job_id", jobId)
        .eq("entity_type", "dorm");

      setLiveStats({
        retryable_count: retryable || 0,
        jsonld_count: jsonld || 0,
        tld_only_count: tld || 0,
        housing_evidence_count: housing || 0,
      });
    } catch (e) {
      console.error("Live stats error:", e);
    }
  }, []);

  // Re-fetch rows when filter changes
  useEffect(() => {
    if (activeJob) fetchRows(activeJob.id);
  }, [activeJob?.id, statusFilter, fetchRows]);

  // ── Core: Single tick + status refresh ──
  const doTickAndRefresh = useCallback(async (jobId: string): Promise<Job | null> => {
    try {
      await api("/geo-verify-orchestrator", {
        method: "POST",
        body: { action: "tick", job_id: jobId },
        timeout: 60000,
      });
    } catch (e: any) {
      addLog(`⚠️ خطأ في tick: ${e.message}`);
    }

    // Always refresh status after tick
    try {
      const res = await api("/geo-verify-orchestrator", { method: "POST", body: { action: "status" } });
      if (res.ok) {
        const job = (res.jobs || []).find((j: Job) => j.id === jobId);
        if (job) {
          setActiveJob(job);
          return job;
        }
      }
    } catch (e) {
      addLog(`⚠️ خطأ في status: ${(e as Error).message}`);
    }
    return null;
  }, [addLog]);

  // ── Auto-tick loop ──
  const startAutoTick = useCallback(async (jobId: string) => {
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;
    autoTickRef.current = true;
    setPhase("running");
    addLog("▶ بدأ التشغيل التلقائي");

    let consecutiveErrors = 0;

    while (autoTickRef.current) {
      setTickCount(c => c + 1);
      const job = await doTickAndRefresh(jobId);

      if (!job) {
        consecutiveErrors++;
        if (consecutiveErrors > 5) {
          addLog("⛔ توقف بسبب أخطاء متتالية");
          setPhase("error");
          break;
        }
      } else {
        consecutiveErrors = 0;
        addLog(`tick ${job.processed_count}/${job.total_count} — ✅${job.verified_count} 🟡${job.flagged_count} ❌${job.failed_count}`);

        if (job.status === "completed") {
          setPhase("completed");
          addLog(`🎉 اكتملت المهمة: ${job.processed_count} جامعة`);
          toast({ title: "✅ اكتملت المهمة", description: `${job.verified_count} verified · ${job.flagged_count} flagged · ${job.failed_count} failed` });
          break;
        }
        if (job.status === "cancelled" || job.status === "failed") {
          setPhase(job.status as RunPhase);
          addLog(`⚠️ المهمة ${job.status}`);
          break;
        }
      }

      // Refresh rows + stats periodically
      fetchRows(jobId);
      fetchLiveStats(jobId);

      // Wait between ticks
      await new Promise(r => setTimeout(r, TICK_INTERVAL_MS));
    }

    loopRunningRef.current = false;
    autoTickRef.current = false;
  }, [doTickAndRefresh, fetchRows, fetchLiveStats, addLog, toast]);

  // ── Full run: create → start → auto-tick ──
  const handleFullRun = async (count: number) => {
    if (phase === "running" || phase === "creating" || phase === "starting") return;

    const traceId = generateTraceId("batch");
    setTickCount(0);
    setRunLog([]);

    // Step 1: Create
    setPhase("creating");
    addLog(`📦 إنشاء مهمة لـ ${count} جامعة (trace: ${traceId})`);
    try {
      const createRes = await api("/geo-verify-orchestrator", {
        method: "POST",
        body: { action: "create_job", max_rows: count, trace_id: traceId },
      });
      if (!createRes.ok) throw new Error(createRes.error || "create failed");
      setActiveJob(createRes.job);
      addLog(`✅ تم إنشاء المهمة: ${createRes.job.id.slice(0, 8)} — ${createRes.target_count} جامعة`);

      // Step 2: Start
      setPhase("starting");
      addLog("🚀 بدء التشغيل...");
      const startRes = await api("/geo-verify-orchestrator", {
        method: "POST",
        body: { action: "start", job_id: createRes.job.id, trace_id: traceId },
      });
      if (!startRes.ok) throw new Error(startRes.error || "start failed");
      addLog(`✅ بدأت المهمة: ${startRes.seeded} صف`);

      // Step 3: Auto-tick
      startAutoTick(createRes.job.id);
    } catch (e: any) {
      setPhase("error");
      addLog(`⛔ خطأ: ${e.message}`);
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handlePause = () => {
    autoTickRef.current = false;
    setPhase("paused");
    addLog("⏸ تم الإيقاف المؤقت");
  };

  const handleResume = () => {
    if (!activeJob || activeJob.status !== "running") return;
    addLog("▶ استئناف التشغيل");
    startAutoTick(activeJob.id);
  };

  const handleCancel = async () => {
    autoTickRef.current = false;
    if (!activeJob) return;
    try {
      await api("/geo-verify-orchestrator", {
        method: "POST",
        body: { action: "cancel", job_id: activeJob.id },
      });
      setPhase("cancelled");
      addLog("🛑 تم إلغاء المهمة");
      toast({ title: "تم إلغاء المهمة" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleReset = () => {
    setActiveJob(null);
    setPhase("idle");
    setRows([]);
    setTickCount(0);
    setRunLog([]);
    setLiveStats({ retryable_count: 0, jsonld_count: 0, tld_only_count: 0, housing_evidence_count: 0 });
  };

  // ── Review Actions ──
  const handlePublish = async (row: VerificationRow) => {
    if (!actorId) return;
    const traceId = generateTraceId();
    const { data, error } = await supabase.rpc("rpc_publish_verified_university_geo", {
      p_row_id: row.id, p_actor_id: actorId, p_trace_id: traceId, p_reason: "approved_via_dashboard",
    });
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    const result = data as any;
    if (!result?.ok) { toast({ title: "رفض", description: result?.error, variant: "destructive" }); return; }
    toast({ title: "✅ تم النشر", description: `trace: ${traceId}` });
    if (activeJob) fetchRows(activeJob.id);
  };

  const handleReject = async (row: VerificationRow) => {
    if (!actorId) return;
    const traceId = generateTraceId();
    const { data, error } = await supabase.rpc("rpc_reject_verified_university_geo", {
      p_row_id: row.id, p_actor_id: actorId, p_trace_id: traceId, p_reason: "rejected_via_dashboard",
    });
    if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    const result = data as any;
    if (!result?.ok) { toast({ title: "فشل", description: result?.error, variant: "destructive" }); return; }
    toast({ title: "تم الرفض", description: `trace: ${traceId}` });
    if (activeJob) fetchRows(activeJob.id);
  };

  const handleForcePublish = async () => {
    if (!actorId || !forceTarget) return;
    setForceLoading(true);
    const traceId = generateTraceId();
    try {
      const { data, error } = await supabase.rpc("rpc_force_publish_geo_after_manual_review", {
        p_row_id: forceTarget.id, p_actor_id: actorId, p_trace_id: traceId, p_reason: forceReason,
        p_override_lat: forceLat ? parseFloat(forceLat) : null, p_override_lon: forceLon ? parseFloat(forceLon) : null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) throw new Error(result?.error);
      toast({ title: "✅ نشر استثنائي", description: `trace: ${traceId}` });
      setForceTarget(null); setForceReason(""); setForceLat(""); setForceLon("");
      if (activeJob) fetchRows(activeJob.id);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setForceLoading(false); }
  };

  const progress = activeJob ? (activeJob.total_count > 0 ? (activeJob.processed_count / activeJob.total_count) * 100 : 0) : 0;
  const remaining = activeJob ? activeJob.total_count - activeJob.processed_count : 0;
  const isRunningOrBusy = phase === "running" || phase === "creating" || phase === "starting";
  const hasRunningJob = activeJob && (activeJob.status === "running" || phase === "paused");

  // Row actions
  const getRowActions = (row: VerificationRow) => {
    const actions: JSX.Element[] = [];
    actions.push(
      <EvidenceDrawer key="ev" universityId={row.university_id} universityName={row.university_name || ""} jobId={row.job_id} />
    );
    if (row.status === "verified") {
      actions.push(
        <Button key="pub" size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handlePublish(row)} title="نشر">
          <Check className="h-4 w-4" />
        </Button>,
        <Button key="rej" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleReject(row)} title="رفض">
          <X className="h-4 w-4" />
        </Button>
      );
    } else if (row.status === "flagged") {
      actions.push(
        <Button key="force" size="icon" variant="ghost" className="h-7 w-7 text-amber-600" onClick={() => setForceTarget(row)} title="نشر استثنائي">
          <Shield className="h-4 w-4" />
        </Button>,
        <Button key="rej" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleReject(row)} title="رفض">
          <X className="h-4 w-4" />
        </Button>
      );
    } else if (row.status === "unverifiable") {
      actions.push(
        <Button key="force" size="icon" variant="ghost" className="h-7 w-7 text-amber-600" onClick={() => setForceTarget(row)} title="نشر استثنائي">
          <Shield className="h-4 w-4" />
        </Button>
      );
    }
    return <div className="flex gap-1">{actions}</div>;
  };

  return (
    <div className="space-y-4">
      {/* ══ Control Panel ══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            التحقق الجغرافي للجامعات
            {phase === "running" && <Badge className="bg-green-600 text-white animate-pulse mr-2">يعمل</Badge>}
            {phase === "paused" && <Badge variant="outline" className="border-yellow-500 text-yellow-700 mr-2">متوقف مؤقتاً</Badge>}
            {phase === "completed" && <Badge className="bg-emerald-600 text-white mr-2">مكتمل</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset Buttons — only show when no running job */}
          {!hasRunningJob && phase !== "running" && (
            <div className="flex flex-wrap gap-2 items-center">
              {PRESETS.map(p => (
                <Button
                  key={p.value}
                  size="sm"
                  disabled={isRunningOrBusy}
                  onClick={() => handleFullRun(p.value)}
                  className={p.value === 500 ? "bg-primary text-primary-foreground font-bold" : ""}
                  variant={p.value === 500 ? "default" : "outline"}
                >
                  {isRunningOrBusy ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Play className="h-4 w-4 ml-1" />}
                  {p.label}
                </Button>
              ))}

              {/* Custom */}
              {showCustom ? (
                <div className="flex gap-1 items-center">
                  <Input
                    type="number"
                    className="w-24 h-8 text-sm"
                    placeholder="العدد"
                    value={customCount}
                    onChange={e => setCustomCount(e.target.value)}
                    min={1}
                    max={2000}
                  />
                  <Button
                    size="sm"
                    disabled={isRunningOrBusy || !customCount || parseInt(customCount) < 1}
                    onClick={() => handleFullRun(parseInt(customCount))}
                  >
                    <Play className="h-4 w-4 ml-1" /> تشغيل
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCustom(false)}>✕</Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setShowCustom(true)} disabled={isRunningOrBusy}>
                  عدد مخصص...
                </Button>
              )}

              {/* Reset to start fresh */}
              {(phase === "completed" || phase === "cancelled" || phase === "error") && (
                <Button size="sm" variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 ml-1" /> مهمة جديدة
                </Button>
              )}
            </div>
          )}

          {/* Running / Paused controls */}
          {hasRunningJob && (
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="outline" className="text-xs font-mono">
                {activeJob!.id.slice(0, 8)} — {activeJob!.processed_count}/{activeJob!.total_count}
              </Badge>

              {phase === "running" && (
                <>
                  <Button size="sm" variant="outline" onClick={handlePause}>
                    <Pause className="h-4 w-4 ml-1" /> إيقاف مؤقت
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleCancel}>
                    <Square className="h-4 w-4 ml-1" /> إلغاء
                  </Button>
                  <span className="text-xs text-muted-foreground">Tick #{tickCount}</span>
                </>
              )}

              {phase === "paused" && (
                <>
                  <Button size="sm" onClick={handleResume}>
                    <Play className="h-4 w-4 ml-1" /> استئناف
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleCancel}>
                    <Square className="h-4 w-4 ml-1" /> إلغاء
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 ml-1" /> تجاهل
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Creating/Starting indicator */}
          {(phase === "creating" || phase === "starting") && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {phase === "creating" ? "جارٍ إنشاء المهمة..." : "جارٍ بدء المعالجة..."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══ KPIs ══ */}
      {activeJob && (
        <>
          {/* Progress bar */}
          <Progress value={progress} className="h-3" />

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">الإجمالي</div>
              <div className="text-xl font-bold">{activeJob.total_count}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">تمت المعالجة</div>
              <div className="text-xl font-bold">{activeJob.processed_count}</div>
              <div className="text-[10px] text-muted-foreground">متبقي: {remaining}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">تم التحقق ✅</div>
              <div className="text-xl font-bold text-green-600">{activeJob.verified_count}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">يحتاج مراجعة 🟡</div>
              <div className="text-xl font-bold text-yellow-600">{activeJob.flagged_count}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">فشل ❌</div>
              <div className="text-xl font-bold text-destructive">{activeJob.failed_count}</div>
            </Card>
          </div>

          {/* Extended stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Card className="p-2">
              <div className="text-[10px] text-muted-foreground">غير قابل للتحقق</div>
              <div className="text-lg font-bold text-muted-foreground">{activeJob.unverifiable_count}</div>
            </Card>
            <Card className="p-2">
              <div className="text-[10px] text-muted-foreground">🔄 قابل لإعادة المحاولة</div>
              <div className="text-lg font-bold">{liveStats.retryable_count}</div>
            </Card>
            <Card className="p-2">
              <div className="text-[10px] text-muted-foreground">📋 JSON-LD</div>
              <div className="text-lg font-bold">{liveStats.jsonld_count}</div>
            </Card>
            <Card className="p-2 flex gap-4">
              <div>
                <div className="text-[10px] text-muted-foreground">🌐 TLD فقط</div>
                <div className="text-lg font-bold">{liveStats.tld_only_count}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground">🏠 سكن</div>
                <div className="text-lg font-bold">{liveStats.housing_evidence_count}</div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ══ Run Log ══ */}
      {runLog.length > 0 && (
        <Card className="p-3">
          <div className="text-xs font-bold mb-1 text-muted-foreground">سجل التشغيل</div>
          <div className="max-h-32 overflow-y-auto font-mono text-[11px] space-y-0.5 text-muted-foreground" dir="ltr">
            {runLog.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </Card>
      )}

      {/* ══ Filters ══ */}
      {activeJob && (
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-sm text-muted-foreground">تصفية:</span>
          {["all", "flagged", "verified", "published", "rejected", "unverifiable", "failed", "pending"].map(s => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s === "all" ? "الكل" : s}
            </Button>
          ))}
        </div>
      )}

      {/* ══ Results Table ══ */}
      {activeJob && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الجامعة</TableHead>
                  <TableHead>الدولة</TableHead>
                  <TableHead>المدينة</TableHead>
                  <TableHead>المكتشفة</TableHead>
                  <TableHead>المدينة المكتشفة</TableHead>
                  <TableHead>الثقة</TableHead>
                  <TableHead>المشاكل</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.id} className={!row.country_match || !row.city_match ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
                    <TableCell className="font-medium text-xs max-w-[200px] truncate">{row.university_name}</TableCell>
                    <TableCell>{row.current_country_code}</TableCell>
                    <TableCell className="text-xs">{row.current_city || "—"}</TableCell>
                    <TableCell className={!row.country_match ? "text-destructive font-bold" : "text-green-600"}>
                      {row.resolved_country_code || "—"}
                    </TableCell>
                    <TableCell className={`text-xs ${!row.city_match ? "text-destructive font-bold" : "text-green-600"}`}>
                      {row.resolved_city || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        (row.confidence || 0) >= 70 ? "border-green-500 text-green-700" :
                        (row.confidence || 0) >= 40 ? "border-yellow-500 text-yellow-700" :
                        "border-destructive text-destructive"
                      }>
                        {row.confidence || 0}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(row.issues || []).map(i => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{i}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[row.status] || ""}>{row.status}</Badge>
                    </TableCell>
                    <TableCell>{getRowActions(row)}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {phase === "idle" ? "اضغط على أحد أزرار التشغيل لبدء مهمة جديدة" : "لا توجد نتائج"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ══ Force Publish Dialog ══ */}
      <Dialog open={!!forceTarget} onOpenChange={open => { if (!open) setForceTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              نشر استثنائي — مراجعة يدوية
            </DialogTitle>
          </DialogHeader>
          {forceTarget && (
            <div className="space-y-4">
              <div className="text-sm">
                <strong>{forceTarget.university_name}</strong>
                <div className="text-muted-foreground text-xs mt-1">
                  الحالة: {forceTarget.status} · الثقة: {forceTarget.confidence}%
                </div>
                {forceTarget.resolved_lat && forceTarget.resolved_lon && (
                  <div className="text-xs text-muted-foreground">
                    إحداثيات مكتشفة: {forceTarget.resolved_lat}, {forceTarget.resolved_lon}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="force-lat">خط العرض</Label>
                  <Input id="force-lat" type="number" step="any" placeholder={forceTarget.resolved_lat?.toString() || "—"} value={forceLat} onChange={e => setForceLat(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="force-lon">خط الطول</Label>
                  <Input id="force-lon" type="number" step="any" placeholder={forceTarget.resolved_lon?.toString() || "—"} value={forceLon} onChange={e => setForceLon(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="force-reason">السبب (مطلوب، 5 أحرف على الأقل)</Label>
                <Textarea id="force-reason" placeholder="مثال: تم التحقق يدويًا عبر Google Maps" value={forceReason} onChange={e => setForceReason(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceTarget(null)}>إلغاء</Button>
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700"
              disabled={forceLoading || forceReason.trim().length < 5}
              onClick={handleForcePublish}
            >
              {forceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "نشر استثنائي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════
// Evidence Drawer
// ══════════════════════════════════════
function EvidenceDrawer({ universityId, universityName, jobId }: { universityId: string; universityName: string; jobId: string }) {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("university_geo_evidence")
      .select("*")
      .eq("university_id", universityId)
      .eq("job_id", jobId)
      .order("confidence", { ascending: false })
      .then(({ data }) => setEvidence((data as any[]) || []));
  }, [open, universityId, jobId]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="عرض الأدلة">
          <Eye className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-right">{universityName}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {evidence.length === 0 && <p className="text-muted-foreground text-sm">لا توجد أدلة</p>}
          {evidence.map(e => (
            <Card key={e.id} className="p-3">
              <div className="flex items-center gap-2 mb-2">
                {e.entity_type === "dorm" ? <Home className="h-4 w-4 text-blue-500" /> : <Building2 className="h-4 w-4 text-primary" />}
                <Badge variant="outline" className="text-xs">{e.source_type}</Badge>
                <Badge variant="outline" className="text-xs">{e.entity_type}</Badge>
                {e.entity_scope && <Badge variant="secondary" className="text-xs">{e.entity_scope}</Badge>}
                <span className="ml-auto text-xs font-mono">{e.confidence}%</span>
              </div>
              <div className="text-xs space-y-1">
                {e.detected_country_code && <div><span className="text-muted-foreground">الدولة:</span> {e.detected_country_code}</div>}
                {e.detected_city && <div><span className="text-muted-foreground">المدينة:</span> {e.detected_city}</div>}
                {e.detected_address && <div><span className="text-muted-foreground">العنوان:</span> {e.detected_address}</div>}
                {(e.detected_lat != null) && <div><span className="text-muted-foreground">الإحداثيات:</span> {e.detected_lat}, {e.detected_lon}</div>}
                {e.source_url && (
                  <div className="truncate">
                    <span className="text-muted-foreground">المصدر:</span>{" "}
                    <a href={e.source_url} target="_blank" rel="noopener" className="text-primary underline">{e.source_url}</a>
                  </div>
                )}
                {e.content_hash && (
                  <div className="text-muted-foreground font-mono text-[9px]">hash: {e.content_hash.slice(0, 16)}…</div>
                )}
                {e.raw_excerpt && (
                  <div className="bg-muted p-2 rounded text-[10px] mt-1 max-h-24 overflow-auto font-mono">
                    {e.raw_excerpt}
                  </div>
                )}
                {e.signals && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(e.signals).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="text-[9px]">{k}: {String(v)}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
