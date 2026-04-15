import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Square, RotateCcw, ServerCog, Clock, Zap, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface Door2State {
  enabled: boolean;
  paused: boolean;
  stages: Record<string, number>;
  stepStatuses: Record<string, number>;
  snapshotsToday: number;
  quarantined: number;
  total: number;
  // Progress tracking
  done: number;
  donePerHour: number;
  done15m: number;
  activeStages: { stage: string; cnt: number }[];
  firstDoneAt: string | null;
  lastActivityAt: string | null;
  // Program detail extraction counters
  programUrlStatuses: Record<string, number>;
  programUrlsTotal: number;
  programDraftsTotal: number;
}

const POLL_INTERVAL = 15_000;

export function Door2HarvestPanel() {
  const { t } = useTranslation("common");
  const { toast } = useToast();

  const [state, setState] = useState<Door2State>({
    enabled: false,
    paused: false,
    stages: {},
    stepStatuses: {},
    snapshotsToday: 0,
    quarantined: 0,
    total: 0,
    done: 0,
    donePerHour: 0,
    done15m: 0,
    activeStages: [],
    firstDoneAt: null,
    lastActivityAt: null,
    programUrlStatuses: {},
    programUrlsTotal: 0,
    programDraftsTotal: 0,
  });
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");

      // Door2 settings
      const [flagRes, configRes] = await Promise.all([
        supabase.from("crawl_settings").select("value").eq("key", "door2_enabled").single(),
        supabase.from("crawl_settings").select("value").eq("key", "door2_config").single(),
      ]);

      const enabled = (flagRes.data?.value as any)?.enabled === true;
      const paused = (configRes.data?.value as any)?.pause === true;

      // Stage counts via RPC (avoids 1000 row limit)
      const { data: stageData } = await supabase.rpc("rpc_door2_stage_counts");

      const stages: Record<string, number> = {};
      let quarantined = 0;
      let totalCount = 0;
      for (const row of (stageData || []) as { stage: string; cnt: number }[]) {
        stages[row.stage] = row.cnt;
        totalCount += row.cnt;
        if (row.stage === "quarantined") quarantined += row.cnt;
      }

      // Step status distribution via count queries (avoids 1000 row limit)
      const stepStatusNames = ["ok", "not_present", "parse_error", "fetch_error", "skipped"];
      const stepCounts = await Promise.all(
        stepStatusNames.map(s => supabase.from("uniranks_step_runs").select("id", { count: "exact", head: true }).eq("status", s))
      );
      const stepStatuses: Record<string, number> = {};
      stepStatusNames.forEach((s, i) => {
        const c = stepCounts[i].count ?? 0;
        if (c > 0) stepStatuses[s] = c;
      });

      // Snapshots today + progress data + program_urls counts in parallel
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const puStatusNames = ["pending", "fetching", "fetched", "retry", "extracted", "failed", "quarantined"];
      const [snapshotRes, progressRes, draftsRes, ...puCounts] = await Promise.all([
        supabase
          .from("uniranks_page_snapshots")
          .select("*", { count: "exact", head: true })
          .gte("fetched_at", todayStart.toISOString()),
        supabase.rpc("rpc_door2_progress"),
        supabase.from("program_draft").select("id", { count: "exact", head: true }),
        ...puStatusNames.map(s => supabase.from("program_urls").select("id", { count: "exact", head: true }).eq("status", s)),
      ]);

      const programUrlStatuses: Record<string, number> = {};
      let programUrlsTotal = 0;
      puStatusNames.forEach((s, i) => {
        const c = puCounts[i].count ?? 0;
        if (c > 0) { programUrlStatuses[s] = c; programUrlsTotal += c; }
      });
      const programDraftsTotal = draftsRes.count ?? 0;

      const snapshotsToday = snapshotRes.count || 0;
      const prog = progressRes.data as any || {};
      const doneCount = prog.done || 0;
      const done1h = prog.done_1h || 0;
      const done15m = prog.done_15m || 0;
      // Extrapolate per-hour rate from 15m window (more responsive)
      const donePerHour = done15m > 0 ? done15m * 4 : done1h;

      setState({
        enabled,
        paused,
        stages,
        stepStatuses,
        snapshotsToday,
        quarantined,
        total: totalCount,
        done: doneCount,
        donePerHour,
        done15m,
        activeStages: prog.active_stages || [],
        firstDoneAt: prog.first_done_at || null,
        lastActivityAt: prog.last_activity_at || null,
        programUrlStatuses,
        programUrlsTotal,
        programDraftsTotal,
      });
    } catch {
      // Will retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (state.enabled && !state.paused) {
      const iv = setInterval(refreshStatus, POLL_INTERVAL);
      return () => clearInterval(iv);
    }
  }, [state.enabled, state.paused, refreshStatus]);

  const handleStart = async (pilotLimit = 0) => {
    setStarting(true);
    try {
      const traceId = crypto.randomUUID();
      const data = await api("/admin-door2-start", {
        method: "POST",
        body: { pilot_limit: pilotLimit },
        headers: { "x-client-trace-id": traceId },
      });
      if (data.ok) {
        toast({ title: t("admin.door2.started") });
        await refreshStatus();
      } else {
        toast({ variant: "destructive", title: data.error || "Failed" });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      const data = await api("/admin-door2-stop", {
        method: "POST",
        body: {},
      });
      if (data.ok) {
        toast({ title: t("admin.door2.stopped") });
        await refreshStatus();
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message });
    } finally {
      setStopping(false);
    }
  };

  const doneCount = (state.stages["done"] || 0);
  const pendingCount = (state.stages["profile_pending"] || 0) + (state.stages["programs_pending"] || 0) + (state.stages["details_pending"] || 0);
  const runningCount = (state.stages["profile_fetching"] || 0) + (state.stages["programs_fetching"] || 0) + (state.stages["details_fetching"] || 0);

  // Progress calculations
  const progressPct = state.total > 0 ? (state.done / state.total) * 100 : 0;
  const remaining = state.total - state.done;
  const etaHours = state.donePerHour > 0 ? remaining / state.donePerHour : null;

  const formatEta = (hours: number | null) => {
    if (hours === null || hours <= 0) return "—";
    if (hours < 1) return `${Math.round(hours * 60)} دقيقة`;
    const d = Math.floor(hours / 24);
    const h = Math.round(hours % 24);
    if (d > 0) return `${d} يوم ${h} ساعة`;
    return `${h} ساعة`;
  };

  const stageLabel = (s: string) => {
    const map: Record<string, string> = {
      profile_fetching: "جلب الملفات الشخصية",
      programs_fetching: "جلب البرامج",
      details_fetching: "جلب التفاصيل",
    };
    return map[s] || s;
  };

  const statusBadge = !state.enabled
    ? <Badge variant="secondary">{t("admin.door2.statusDisabled")}</Badge>
    : state.paused
      ? <Badge variant="outline">{t("admin.door2.statusPaused")}</Badge>
      : <Badge className="bg-primary text-primary-foreground animate-pulse">{t("admin.door2.statusRunning")}</Badge>;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t("admin.door2.title")}</CardTitle>
          {statusBadge}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ServerCog className="h-4 w-4" />
          {t("admin.door2.description")}
          <Badge variant="outline" className="text-[10px]">Server-side (Runner Tick)</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stage Distribution */}
        {state.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
            <div className="bg-muted/50 rounded p-2">
              <div className="text-lg font-bold">{pendingCount.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{t("admin.door2.pending")}</div>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <div className="text-lg font-bold">{runningCount.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{t("admin.door2.running")}</div>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <div className="text-lg font-bold">{doneCount.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{t("admin.door2.done")}</div>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <div className="text-lg font-bold">{state.quarantined.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{t("admin.door2.quarantined")}</div>
            </div>
          </div>
        )}

        {/* Progress Bar & ETA */}
        {state.total > 0 && state.enabled && (
          <div className="space-y-3 bg-muted/30 rounded-lg p-3 border">
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  التقدم الكلي
                </span>
                <span className="font-bold text-primary">{progressPct.toFixed(1)}%</span>
              </div>
              <Progress value={progressPct} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{state.done.toLocaleString()} / {state.total.toLocaleString()} جامعة</span>
                <span>{remaining.toLocaleString()} متبقي</span>
              </div>
            </div>

            {/* Speed & ETA row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-background rounded p-2">
                <div className="flex items-center justify-center gap-1 text-sm font-bold text-primary">
                  <Zap className="h-3.5 w-3.5" />
                  {state.donePerHour.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">جامعة/ساعة</div>
              </div>
              <div className="bg-background rounded p-2">
                <div className="flex items-center justify-center gap-1 text-sm font-bold">
                  <Clock className="h-3.5 w-3.5" />
                  {formatEta(etaHours)}
                </div>
                <div className="text-[10px] text-muted-foreground">الوقت المتبقي</div>
              </div>
              <div className="bg-background rounded p-2">
                <div className="text-sm font-bold">{state.done15m}</div>
                <div className="text-[10px] text-muted-foreground">مكتمل / 15 د</div>
              </div>
            </div>

            {/* Current active stages */}
            {state.activeStages && state.activeStages.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <ServerCog className="h-3.5 w-3.5 text-primary animate-spin" />
                <span className="text-muted-foreground">يعمل الآن:</span>
                {state.activeStages.map((s) => (
                  <Badge key={s.stage} variant="outline" className="text-[10px]">
                    {stageLabel(s.stage)} ({s.cnt})
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Program Detail Extraction Counters */}
        {state.programUrlsTotal > 0 && (
          <div className="space-y-2 bg-muted/30 rounded-lg p-3 border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">استخراج تفاصيل البرامج</span>
              <Badge variant="outline" className="text-[10px]">
                {state.programUrlsTotal} رابط · {state.programDraftsTotal} مسودة
              </Badge>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
              {["extracted", "fetching", "fetched", "pending", "retry", "failed"].map((s) => {
                const count = state.programUrlStatuses[s] ?? 0;
                const colorClass = s === "extracted" ? "text-green-600" : s === "failed" ? "text-destructive" : s === "fetching" ? "text-primary" : "";
                return (
                  <div key={s} className="bg-background rounded p-2">
                    <div className={`text-sm font-bold ${colorClass}`}>{count.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">{s}</div>
                  </div>
                );
              })}
            </div>
            {state.programUrlsTotal > 0 && (
              <Progress 
                value={((state.programUrlStatuses["extracted"] ?? 0) + (state.programUrlStatuses["failed"] ?? 0)) / state.programUrlsTotal * 100} 
                className="h-2" 
              />
            )}
          </div>
        )}

        {Object.keys(state.stepStatuses).length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">{t("admin.door2.stepStatuses")}</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(state.stepStatuses).map(([status, count]) => (
                <Badge key={status} variant="outline" className="text-xs">
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Snapshots Today */}
        {state.snapshotsToday > 0 && (
          <div className="text-sm text-muted-foreground">
            {t("admin.door2.snapshotsToday")}: <span className="font-bold">{state.snapshotsToday}</span>
          </div>
        )}

        {/* Running indicator */}
        {state.enabled && !state.paused && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded p-2">
            <ServerCog className="h-4 w-4 text-primary animate-spin" />
            {t("admin.door2.autoRunning")}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!state.enabled && (
            <>
              <Button onClick={() => handleStart(25)} disabled={starting} variant="outline" className="flex-1">
                {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {t("admin.door2.startPilot")}
              </Button>
              <Button onClick={() => handleStart(0)} disabled={starting} className="flex-1">
                {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {t("admin.door2.startAll")}
              </Button>
            </>
          )}

          {state.enabled && !state.paused && (
            <Button onClick={handleStop} disabled={stopping} variant="destructive" className="w-full">
              {stopping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Square className="h-4 w-4 mr-2" />}
              {t("admin.door2.stop")}
            </Button>
          )}

          {state.enabled && state.paused && (
            <Button onClick={() => handleStart(0)} disabled={starting} className="w-full">
              {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              {t("admin.door2.resume")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
