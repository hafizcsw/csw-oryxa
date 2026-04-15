import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, RefreshCw, CheckCircle2, Clock, Square, Server, Monitor, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface D5Stats {
  totalSeeds: number;
  matched: number;
  unmatched: number;
}

interface OrchestratorState {
  active: boolean;
  current_phase: string;
  phase_index: number;
  started_at: string | null;
  last_tick_at: string | null;
  tick_count: number;
  trace_id: string;
  stats: Record<string, number>;
  log: string[];
  consecutive_errors: number;
}

const PHASE_LABELS: Record<string, string> = {
  idle: "جاهز",
  phase0_index: "فهرسة البذور",
  phase0_match: "مطابقة البذور",
  phase1: "إثراء الجامعات",
  phase2_programs: "قوائم البرامج",
  phase2b_details: "تفاصيل البرامج",
  phase2c_employment: "بيانات التوظيف",
  phase2d_useful: "معلومات مفيدة",
  phase3_map: "ربط البرامج",
  phase4_publish: "نشر البرامج",
  done: "✅ اكتمل",
  error: "❌ خطأ",
  stopped: "⏹️ متوقف",
};

const TOTAL_PHASES = 9; // phase0_index, phase0_match, phase1, phase2_programs, phase2b_details, phase2c_employment, phase2d_useful, phase3_map, phase4_publish

function getPhaseProgress(phaseIndex: number, orchState?: OrchestratorState | null, totalSeeds?: number): number {
  if (!orchState) return 0;
  if (orchState.current_phase === "done") return 100;
  if (phaseIndex >= TOTAL_PHASES) return 100;

  const phaseWeight = 100 / TOTAL_PHASES;
  const baseProgress = phaseIndex * phaseWeight;

  // Intra-phase progress based on phases_done counts
  let intraProgress = 0.5; // default
  const s = orchState.stats || {};
  const seeds = totalSeeds || s.phase0_index_seeds_total || 123;

  // Use phase-specific processed count vs total seeds
  const phaseKey = orchState.current_phase;
  const processed = s[`${phaseKey}_total_processed`] || s[`${phaseKey}_total_crawled`] || 0;
  if (seeds > 0 && processed > 0) {
    intraProgress = Math.min(processed / seeds, 0.99);
  }

  return Math.round(baseProgress + intraProgress * phaseWeight);
}

export function D5RussiaDashboard() {
  const { toast } = useToast();
  const [stats, setStats] = useState<D5Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [orchState, setOrchState] = useState<OrchestratorState | null>(null);
  const [commanding, setCommanding] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const [seedsRes, stateRes] = await Promise.all([
        supabase
          .from("university_external_ids")
          .select("university_id, match_method")
          .eq("source_name", "studyinrussia"),
        supabase
          .from("crawl_settings")
          .select("value")
          .eq("key", "d5_orchestrator")
          .maybeSingle(),
      ]);

      const seeds = seedsRes.data || [];
      const matched = seeds.filter((s: any) => s.university_id !== null).length;

      setStats({
        totalSeeds: seeds.length,
        matched,
        unmatched: seeds.length - matched,
      });

      if (stateRes.data?.value) {
        setOrchState(stateRes.data.value as any);
      }
    } catch (err) {
      console.error("D5 stats fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Poll as fallback every 30s (realtime is primary)
    const interval = setInterval(fetchStats, 30_000);

    // Realtime subscription for instant updates
    const channel = supabase
      .channel("d5-progress-live")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "crawl_settings",
          filter: "key=eq.d5_orchestrator",
        },
        (payload) => {
          const newVal = (payload.new as any)?.value;
          if (newVal) {
            setOrchState(newVal as OrchestratorState);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  const sendCommand = async (command: "start" | "stop" | "restart") => {
    setCommanding(true);
    try {
      const result = await api("/door5-orchestrator", {
        method: "POST",
        body: { command },
        timeout: 30000,
      });
      if (result.state) setOrchState(result.state);
      const messages: Record<string, { title: string; desc: string }> = {
        start: { title: "🚀 بدأ الزحف الآلي", desc: "الزحف يعمل الآن على السيرفر — يمكنك إغلاق النافذة" },
        stop: { title: "⏹️ تم إيقاف الزحف", desc: "تم إيقاف الزحف بنجاح" },
        restart: { title: "🔄 إعادة الزحف الكامل", desc: `تم مسح التقدم القديم وبدء الزحف من جديد — ${result.reset?.reset_count ?? ''} سجل` },
      };
      toast({ title: messages[command].title, description: messages[command].desc });
      fetchStats();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setCommanding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>جاري تحميل بيانات باب ٥...</span>
      </div>
    );
  }

  const matchPct = stats && stats.totalSeeds > 0 ? Math.round((stats.matched / stats.totalSeeds) * 100) : 0;
  const isActive = orchState?.active ?? false;
  const currentPhase = orchState?.current_phase ?? "idle";
  const phaseProgress = getPhaseProgress(orchState?.phase_index ?? 0, orchState, stats?.matched);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold">باب ٥ — StudyInRussia Pipeline</h3>
          <p className="text-sm text-muted-foreground">زحف وإثراء الجامعات الروسية من studyinrussia.ru</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats}>
          <RefreshCw className="h-4 w-4 ml-1" />
          تحديث
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">إجمالي البذور</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSeeds ?? 0}</div>
            <p className="text-xs text-muted-foreground">من فهرس SIR</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">مطابقة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.matched ?? 0}</div>
            <Progress value={matchPct} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1">{matchPct}% من البذور</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">غير مطابقة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats?.unmatched ?? 0}</div>
            <p className="text-xs text-muted-foreground">تحتاج مطابقة يدوية</p>
          </CardContent>
        </Card>
      </div>

      {/* Server-Driven Crawl Card */}
      <Card className={isActive ? "border-primary" : ""}>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              الزحف الآلي — يعمل على السيرفر
            </span>
            <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
              {isActive ? "🟢 نشط" : "⚪ متوقف"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            يعمل تلقائياً كل دقيقة على السيرفر — لا حاجة لإبقاء النافذة مفتوحة
          </p>

          {/* Progress */}
          {orchState && currentPhase !== "idle" && (() => {
            const s = orchState.stats || {};
            const tickCount = orchState.tick_count || 0;
            const totalSeeds = stats?.matched || s.phase0_index_seeds_total || 0;
            
            // Aggregate all processed counts across phases
            const allProcessed = Object.entries(s)
              .filter(([k]) => k.endsWith('_total_processed') || k.endsWith('_total_crawled'))
              .reduce((sum, [, v]) => sum + (v || 0), 0);
            const allFailed = Object.entries(s)
              .filter(([k]) => k.endsWith('_failed'))
              .reduce((sum, [, v]) => sum + (v || 0), 0);
            
            // Current phase specific
            const phaseKey = currentPhase;
            const phaseProcessed = s[`${phaseKey}_total_processed`] || s[`${phaseKey}_total_crawled`] || 0;
            
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{PHASE_LABELS[currentPhase] || currentPhase}</span>
                  <span className="font-bold text-primary">{phaseProgress}%</span>
                </div>
                <Progress 
                  value={phaseProgress} 
                  className={`h-3 transition-all duration-500 ${
                    currentPhase === "error" ? "[&>div]:bg-destructive" : 
                    currentPhase === "done" ? "[&>div]:bg-green-600" : ""
                  }`}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-muted/50 rounded-md p-2 text-center">
                    <div className="font-bold text-foreground">{allProcessed.toLocaleString()}</div>
                    <div className="text-muted-foreground">صفحات مزحوفة</div>
                    {totalSeeds > 0 && (
                      <div className="text-muted-foreground">من {totalSeeds.toLocaleString()}</div>
                    )}
                  </div>
                  <div className="bg-muted/50 rounded-md p-2 text-center">
                    <div className="font-bold text-foreground">{phaseProcessed.toLocaleString()}</div>
                    <div className="text-muted-foreground">جامعة مُعالجة</div>
                  </div>
                  <div className="bg-muted/50 rounded-md p-2 text-center">
                    <div className="font-bold text-foreground">{allFailed}</div>
                    <div className="text-muted-foreground">فشل</div>
                  </div>
                  <div className="bg-muted/50 rounded-md p-2 text-center">
                    <div className="font-bold text-foreground">#{tickCount}</div>
                    <div className="text-muted-foreground">Tick</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Phase status cards */}
          {orchState && orchState.phase_index > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: "phase0", label: "فهرسة ومطابقة", idx: 0, span: 2 },
                { id: "phase1", label: "إثراء", idx: 2 },
                { id: "phase2_programs", label: "قوائم البرامج", idx: 3 },
                { id: "phase2b_details", label: "تفاصيل", idx: 4 },
                { id: "phase2c_employment", label: "توظيف", idx: 5 },
                { id: "phase2d_useful", label: "معلومات مفيدة", idx: 6 },
                { id: "phase3_map", label: "ربط", idx: 7 },
                { id: "phase4_publish", label: "نشر", idx: 8 },
              ].map((p) => {
                const isDone = orchState.phase_index > p.idx;
                const isCurrent = orchState.phase_index === p.idx && isActive;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${
                      isCurrent ? "border-primary bg-primary/5" :
                      isDone ? "border-green-600/30 bg-green-600/5" :
                      "border-border bg-muted/30"
                    }`}
                  >
                    {isCurrent ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{p.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Server info */}
          {orchState && isActive && (
            <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 rounded-lg p-3">
              <p>🔄 Tick: #{orchState.tick_count} | آخر نبضة: {orchState.last_tick_at ? new Date(orchState.last_tick_at).toLocaleTimeString("ar-SA") : "—"}</p>
              <p>📡 Trace: {orchState.trace_id}</p>
              {orchState.consecutive_errors > 0 && (
                <p className="text-destructive">⚠️ أخطاء متتالية: {orchState.consecutive_errors}</p>
              )}
            </div>
          )}

          {/* Server log */}
          {orchState?.log && orchState.log.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                📋 سجل السيرفر ({orchState.log.length} سطر)
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-muted rounded-lg p-3 max-h-48 overflow-auto mt-2">
                  {orchState.log.slice(-30).map((line, i) => (
                    <p key={i} className="text-xs font-mono leading-relaxed" dir="rtl">{line}</p>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {!isActive ? (
              <>
                <Button 
                  onClick={() => sendCommand("start")} 
                  disabled={commanding}
                  className="flex-1"
                  size="lg"
                >
                  {commanding ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <Play className="h-4 w-4 ml-2" />
                  )}
                  بدء الزحف الآلي ({stats?.matched ?? 0} جامعة)
                </Button>
                <Button 
                  onClick={() => sendCommand("restart")} 
                  disabled={commanding}
                  variant="outline"
                  size="lg"
                  className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                >
                  {commanding ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <RotateCcw className="h-4 w-4 ml-2" />
                  )}
                  إعادة الزحف الكامل
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => sendCommand("stop")} 
                disabled={commanding}
                variant="destructive"
                className="flex-1"
                size="lg"
              >
                {commanding ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <Square className="h-4 w-4 ml-2" />
                )}
                إيقاف الزحف
              </Button>
            )}
          </div>

          {currentPhase === "done" && (
            <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20 text-sm">
              <p className="font-medium text-green-700">🎉 اكتمل الزحف بنجاح!</p>
              {orchState?.stats && (
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {Object.entries(orchState.stats)
                    .filter(([, v]) => v > 0)
                    .slice(0, 10)
                    .map(([k, v]) => (
                      <p key={k}>{k}: {v}</p>
                    ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
