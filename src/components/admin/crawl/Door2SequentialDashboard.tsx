import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Loader2, Play, Square, CheckCircle, Clock, Zap, University, FileText, DollarSign, GraduationCap, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QsProofRunPanel } from "./QsProofRunPanel";

interface UniBatchProgress {
  university_id: string;
  university_name: string;
  uniranks_rank: number | null;
  crawl_stage: string;
  programs_total: number;
  programs_extracted: number;
  programs_failed: number;
  programs_pending: number;
  drafts_count: number;
  has_tuition: number;
  has_ielts: number;
  has_degree: number;
}

interface SeqConfig {
  mode: string;
  batch_university_ids: string[];
  batch_size: number;
  batch_number: number;
  total_batches_completed: number;
  batch_started_at: string | null;
  last_batch_completed_at: string | null;
  source: string;
}

const POLL_INTERVAL = 10_000;

export function Door2SequentialDashboard() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SeqConfig | null>(null);
  const [batchProgress, setBatchProgress] = useState<UniBatchProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [batchSize, setBatchSize] = useState(50);
  const [selectedSource, setSelectedSource] = useState<"uniranks" | "qs">("uniranks");
  const [globalStats, setGlobalStats] = useState({ done: 0, total: 0, profile_pending: 0, programs_pending: 0, quarantined: 0 });

  const refresh = useCallback(async () => {
    try {
      // Get sequential config
      const { data: configRow, error: configErr } = await supabase
        .from("crawl_settings").select("value").eq("key", "door2_sequential_config").single();
      
      if (configErr) console.warn("[seq-dash] Config error:", configErr.message);
      
      const cfg = (configRow?.value as any) ?? {};
      setConfig({
        mode: cfg.mode ?? "off",
        batch_university_ids: cfg.batch_university_ids ?? [],
        batch_size: cfg.batch_size ?? 5,
        batch_number: cfg.batch_number ?? 0,
        total_batches_completed: cfg.total_batches_completed ?? 0,
        batch_started_at: cfg.batch_started_at ?? null,
        last_batch_completed_at: cfg.last_batch_completed_at ?? null,
        source: cfg.source ?? "uniranks",
      });
      setBatchSize(cfg.batch_size ?? 5);
      if (cfg.source) setSelectedSource(cfg.source);

      // Get per-university progress if batch active (limit to first 20 for performance)
      const batchIds = cfg.batch_university_ids ?? [];
      if (batchIds.length > 0) {
        const limitedIds = batchIds.slice(0, 20);
        const { data: progress, error: progressErr } = await supabase.rpc("rpc_door2_batch_progress", {
          p_university_ids: limitedIds,
        });
        if (progressErr) console.warn("[seq-dash] Progress error:", progressErr.message);
        setBatchProgress((progress as unknown as UniBatchProgress[]) ?? []);
      } else {
        setBatchProgress([]);
      }

      // Global stage counts
      const { data: stageData, error: stageErr } = await supabase.rpc("rpc_door2_stage_counts");
      if (stageErr) console.warn("[seq-dash] Stage counts error:", stageErr.message);
      const stages: Record<string, number> = {};
      let total = 0;
      for (const row of (stageData || []) as { stage: string; cnt: number }[]) {
        stages[row.stage] = row.cnt;
        total += row.cnt;
      }
      setGlobalStats({
        done: stages["done"] ?? 0,
        total,
        profile_pending: stages["profile_pending"] ?? 0,
        programs_pending: stages["programs_pending"] ?? 0,
        quarantined: stages["quarantined"] ?? 0,
      });
    } catch (e: any) {
      console.warn("[seq-dash] Refresh error:", e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  
  useEffect(() => {
    if (config?.mode === "sequential") {
      const iv = setInterval(refresh, POLL_INTERVAL);
      return () => clearInterval(iv);
    }
  }, [config?.mode, refresh]);

  const handleStart = async () => {
    setStarting(true);
    try {
      // Run lock: source is locked for ENTIRE sequential run (not just when batch has items)
      const { data: currentCfg } = await supabase
        .from("crawl_settings").select("value").eq("key", "door2_sequential_config").single();
      const currentSeq = (currentCfg?.value as any) ?? {};
      if (currentSeq.mode === "sequential") {
        const activeSource = currentSeq.source || "uniranks";
        if (activeSource !== selectedSource) {
          toast({
            variant: "destructive",
            title: `المصدر مقفول على ${activeSource === "qs" ? "QS" : "UniRanks"} طوال فترة التشغيل. أوقف التشغيل أولاً.`,
          });
          return;
        }
      }

      await supabase.from("crawl_settings").upsert({
        key: "door2_sequential_config",
        value: {
          mode: "sequential",
          batch_university_ids: [],
          batch_size: batchSize,
          batch_number: 0,
          total_batches_completed: 0,
          source: selectedSource,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      // Ensure door2 is enabled and unpaused
      await supabase.from("crawl_settings").upsert({
        key: "door2_enabled",
        value: { enabled: true },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      const { data: existingConfig } = await supabase
        .from("crawl_settings").select("value").eq("key", "door2_config").single();
      const currentConfig = (existingConfig?.value as any) ?? {};
      await supabase.from("crawl_settings").upsert({
        key: "door2_config",
        value: { ...currentConfig, pause: false },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      toast({ title: `تم تشغيل الوضع التسلسلي — مصدر: ${selectedSource === "qs" ? "QS" : "UniRanks"}` });
      await refresh();
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await supabase.from("crawl_settings").upsert({
        key: "door2_sequential_config",
        value: { mode: "off", batch_university_ids: [], batch_size: batchSize, source: selectedSource },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      await supabase.from("crawl_settings").upsert({
        key: "door2_config",
        value: { pause: true, max_units_per_tick: 5, lock_seconds: 120 },
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      toast({ title: "تم إيقاف الوضع التسلسلي" });
      await refresh();
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setStopping(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isRunning = config?.mode === "sequential";
  const hasBatch = (config?.batch_university_ids?.length ?? 0) > 0;
  const progressPct = globalStats.total > 0 ? (globalStats.done / globalStats.total) * 100 : 0;
  const activeSource = config?.source || selectedSource;

  return (
    <div className="space-y-4">
      {/* Source Selector */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">المصدر:</span>
            <Tabs
              value={isRunning ? activeSource : selectedSource}
              onValueChange={(v) => !isRunning && setSelectedSource(v as "uniranks" | "qs")}
              className="w-auto"
            >
              <TabsList>
                <TabsTrigger value="uniranks" disabled={isRunning}>
                  UniRanks
                </TabsTrigger>
                <TabsTrigger value="qs" disabled={isRunning}>
                  QS TopUniversities
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {isRunning && (
              <Badge variant="outline" className="text-xs">
                مصدر نشط: {activeSource === "qs" ? "QS" : "UniRanks"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Control Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">🔄 الوضع التسلسلي — Sequential Batch Mode</CardTitle>
            {isRunning ? (
              <Badge className="bg-primary text-primary-foreground animate-pulse">يعمل</Badge>
            ) : (
              <Badge variant="secondary">متوقف</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Global Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>التقدم الكلي</span>
              <span className="font-bold">{globalStats.done.toLocaleString()} / {globalStats.total.toLocaleString()} ({progressPct.toFixed(1)}%)</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>انتظار: {globalStats.profile_pending.toLocaleString()}</span>
              <span>برامج: {globalStats.programs_pending.toLocaleString()}</span>
              <span>منتهي: {globalStats.done.toLocaleString()}</span>
              <span>معزول: {globalStats.quarantined.toLocaleString()}</span>
            </div>
          </div>

          {/* Batch Stats */}
          {isRunning && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/50 rounded p-2">
                <div className="text-lg font-bold text-primary">{config?.batch_number ?? 0}</div>
                <div className="text-xs text-muted-foreground">الدفعة الحالية</div>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <div className="text-lg font-bold">{config?.total_batches_completed ?? 0}</div>
                <div className="text-xs text-muted-foreground">دفعات مكتملة</div>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <div className="text-lg font-bold">{config?.batch_university_ids?.length ?? 0}</div>
                <div className="text-xs text-muted-foreground">جامعات في الدفعة</div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2 items-center">
            {!isRunning && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">حجم الدفعة:</span>
                  <Input
                    type="number" value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-20" min={1} max={100}
                  />
                </div>
                <Button onClick={handleStart} disabled={starting} className="flex-1">
                  {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  تشغيل ({selectedSource === "qs" ? "QS" : "UniRanks"})
                </Button>
              </>
            )}
            {isRunning && (
              <Button onClick={handleStop} disabled={stopping} variant="destructive" className="w-full">
                {stopping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                إيقاف
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Per-University Progress */}
      {hasBatch && batchProgress.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">📊 تقدم الدفعة الحالية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {batchProgress.map((uni) => {
              const terminal = uni.programs_extracted + uni.programs_failed;
              const completionPct = uni.programs_total > 0 ? (terminal / uni.programs_total) * 100 : 0;
              const isDone = uni.crawl_stage === "done" && uni.programs_pending === 0;
              const fieldCoverage = uni.drafts_count > 0 ? {
                tuition: Math.round((uni.has_tuition / uni.drafts_count) * 100),
                ielts: Math.round((uni.has_ielts / uni.drafts_count) * 100),
                degree: Math.round((uni.has_degree / uni.drafts_count) * 100),
              } : { tuition: 0, ielts: 0, degree: 0 };

              return (
                <div
                  key={uni.university_id}
                  className={`rounded-lg border p-3 space-y-2 ${isDone ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : "bg-background"}`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isDone ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <University className="h-4 w-4 text-primary animate-pulse" />
                      )}
                      <span className="font-medium text-sm truncate max-w-[300px]">
                        {uni.university_name || uni.university_id.slice(0, 8)}
                      </span>
                      {uni.uniranks_rank && (
                        <Badge variant="outline" className="text-[10px]">#{uni.uniranks_rank}</Badge>
                      )}
                    </div>
                    <Badge variant={isDone ? "default" : "secondary"} className="text-[10px]">
                      {uni.crawl_stage}
                    </Badge>
                  </div>

                  {/* Programs Progress */}
                  {uni.programs_total > 0 && (
                    <>
                      <Progress value={completionPct} className="h-2" />
                      <div className="grid grid-cols-5 gap-1 text-center">
                        <div>
                          <div className="text-xs font-bold">{uni.programs_total}</div>
                          <div className="text-[9px] text-muted-foreground">إجمالي</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-green-600">{uni.programs_extracted}</div>
                          <div className="text-[9px] text-muted-foreground">مُستخرج</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-destructive">{uni.programs_failed}</div>
                          <div className="text-[9px] text-muted-foreground">فاشل</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-primary">{uni.programs_pending}</div>
                          <div className="text-[9px] text-muted-foreground">قيد التنفيذ</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold">{uni.drafts_count}</div>
                          <div className="text-[9px] text-muted-foreground">مسودات</div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Field Coverage */}
                  {uni.drafts_count > 0 && (
                    <div className="flex gap-2 text-[10px]">
                      <span className="flex items-center gap-0.5">
                        <DollarSign className="h-3 w-3" /> رسوم: {fieldCoverage.tuition}%
                      </span>
                      <span className="flex items-center gap-0.5">
                        <ShieldCheck className="h-3 w-3" /> IELTS: {fieldCoverage.ielts}%
                      </span>
                      <span className="flex items-center gap-0.5">
                        <GraduationCap className="h-3 w-3" /> درجة: {fieldCoverage.degree}%
                      </span>
                    </div>
                  )}

                  {/* No programs yet */}
                  {uni.programs_total === 0 && uni.crawl_stage !== "done" && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> جاري اكتشاف البرامج...
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Waiting for batch */}
      {isRunning && !hasBatch && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            جاري اختيار الدفعة التالية من الجامعات...
          </CardContent>
        </Card>
      )}

      {/* QS Proof Run Panel — only when QS source is selected */}
      {(activeSource === "qs" || selectedSource === "qs") && (
        <QsProofRunPanel />
      )}
    </div>
  );
}
