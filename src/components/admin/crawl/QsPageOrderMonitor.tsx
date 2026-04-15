import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, AlertTriangle, Clock, Database, Layers, Activity } from "lucide-react";

interface CursorData {
  run_id: string;
  phase: string;
  status: string;
  current_page: number;
  total_pages_estimated: number | null;
  total_entries: number;
  consecutive_errors: number;
  last_tick_at: string;
  tick_count: number;
  started_at: string;
  pages_per_tick: number;
}

interface PageProof {
  page_number: number;
  entry_count: number;
  first_rank_raw: string;
  last_rank_raw: string;
  is_valid: boolean;
  shell_reason: string | null;
  fetched_at: string;
  fetch_duration_ms: number | null;
}

interface StatusBreakdown {
  crawl_status: string;
  count: number;
}

export function QsPageOrderMonitor() {
  const [cursor, setCursor] = useState<CursorData | null>(null);
  const [recentPages, setRecentPages] = useState<PageProof[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      // Fetch cursor
      const { data: cursorRows } = await supabase
        .from("qs_acquisition_cursor")
        .select("run_id, phase, status, current_page, total_pages_estimated, total_entries, consecutive_errors, last_tick_at, tick_count, started_at, pages_per_tick")
        .eq("id", "qs_acq")
        .limit(1);

      if (cursorRows?.[0]) {
        const c = cursorRows[0] as CursorData;
        setCursor(c);

        // Fetch recent page proofs
        const { data: pages } = await supabase
          .from("qs_page_proofs")
          .select("page_number, entry_count, first_rank_raw, last_rank_raw, is_valid, shell_reason, fetched_at, fetch_duration_ms")
          .eq("acquisition_run_id", c.run_id)
          .order("page_number", { ascending: false })
          .limit(10);

        if (pages) setRecentPages(pages as PageProof[]);

        // Fetch status breakdown
        const { data: breakdown } = await supabase
          .rpc("qs_page_entries_status_breakdown" as any, { p_run_id: c.run_id });

        // Fallback: raw query via edge function if RPC doesn't exist
        if (!breakdown) {
          // Simple fallback - just show cursor data
          setStatusBreakdown([]);
        } else {
          setStatusBreakdown(breakdown as StatusBreakdown[]);
        }
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error("QS Monitor fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Also try a direct approach for status breakdown
  useEffect(() => {
    if (!cursor?.run_id) return;
    
    const fetchBreakdown = async () => {
      try {
        const { data } = await supabase
          .from("qs_page_entries")
          .select("crawl_status")
          .eq("acquisition_run_id", cursor.run_id);
        
        if (data) {
          const counts: Record<string, number> = {};
          data.forEach((r: any) => {
            counts[r.crawl_status] = (counts[r.crawl_status] || 0) + 1;
          });
          setStatusBreakdown(
            Object.entries(counts).map(([crawl_status, count]) => ({ crawl_status, count }))
          );
        }
      } catch (err) {
        // Ignore - RLS might block
      }
    };
    fetchBreakdown();
  }, [cursor?.run_id, lastRefresh]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000); // refresh every 15s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cursor) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          لا يوجد تشغيل نشط لزحف QS Page-Order
        </CardContent>
      </Card>
    );
  }

  const timeSinceLastTick = cursor.last_tick_at
    ? Math.round((Date.now() - new Date(cursor.last_tick_at).getTime()) / 1000)
    : null;

  const isHealthy = timeSinceLastTick !== null && timeSinceLastTick < 120;
  const estimatedTotal = cursor.total_pages_estimated || 51;
  const progressPct = Math.min(100, (cursor.current_page / estimatedTotal) * 100);

  const statusColor = (s: string) => {
    switch (s) {
      case "running": return "default";
      case "completed": return "secondary";
      case "paused": return "outline";
      case "error": return "destructive";
      default: return "outline";
    }
  };

  const phaseLabel = cursor.phase === "acquisition" ? "استحواذ الصفحات" : "زحف البروفايلات";

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              QS Page-Order Full Crawl (Autonomous)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={statusColor(cursor.status)}>
                {cursor.status === "running" && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                {cursor.status}
              </Badge>
              {isHealthy ? (
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                  <CheckCircle2 className="h-3 w-3 ml-1" />
                  cron نشط
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 ml-1" />
                  cron متوقف
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{phaseLabel}</span>
              <span className="font-mono">{cursor.current_page} / ~{estimatedTotal} صفحة</span>
            </div>
            <Progress value={progressPct} className="h-3" />
          </div>

          {/* Key metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              icon={<Database className="h-4 w-4" />}
              label="جامعات مكتشفة"
              value={cursor.total_entries.toLocaleString()}
            />
            <MetricCard
              icon={<Layers className="h-4 w-4" />}
              label="صفحات مكتملة"
              value={cursor.current_page.toString()}
            />
            <MetricCard
              icon={<Clock className="h-4 w-4" />}
              label="آخر tick"
              value={timeSinceLastTick !== null ? `${timeSinceLastTick}ث` : "—"}
              alert={timeSinceLastTick !== null && timeSinceLastTick > 120}
            />
            <MetricCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="أخطاء متتالية"
              value={cursor.consecutive_errors.toString()}
              alert={cursor.consecutive_errors > 0}
            />
          </div>

          {/* Run info */}
          <div className="text-xs text-muted-foreground flex flex-wrap gap-4 border-t pt-3">
            <span>Run ID: <code className="text-foreground">{cursor.run_id}</code></span>
            <span>Ticks: <code className="text-foreground">{cursor.tick_count}</code></span>
            <span>بدأ: <code className="text-foreground">{new Date(cursor.started_at).toLocaleString("ar")}</code></span>
            <span>آخر تحديث: <code className="text-foreground">{lastRefresh.toLocaleTimeString("ar")}</code></span>
          </div>
        </CardContent>
      </Card>

      {/* Status breakdown */}
      {statusBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">توزيع حالات الجامعات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {statusBreakdown.map((s) => (
                <Badge key={s.crawl_status} variant="outline" className="text-sm px-3 py-1">
                  {s.crawl_status}: <span className="font-bold mr-1">{s.count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent pages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">آخر الصفحات المُستحوذة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-right">
                  <th className="p-2">#</th>
                  <th className="p-2">سجلات</th>
                  <th className="p-2">أول رتبة</th>
                  <th className="p-2">آخر رتبة</th>
                  <th className="p-2">صالحة</th>
                  <th className="p-2">وقت الجلب</th>
                  <th className="p-2">مدة (ms)</th>
                </tr>
              </thead>
              <tbody>
                {recentPages.map((p) => (
                  <tr key={p.page_number} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-2 font-mono font-bold">{p.page_number}</td>
                    <td className="p-2">{p.entry_count}</td>
                    <td className="p-2 font-mono text-xs">{p.first_rank_raw}</td>
                    <td className="p-2 font-mono text-xs">{p.last_rank_raw}</td>
                    <td className="p-2">
                      {p.is_valid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <span className="text-destructive text-xs">{p.shell_reason || "❌"}</span>
                      )}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {new Date(p.fetched_at).toLocaleTimeString("ar")}
                    </td>
                    <td className="p-2 font-mono text-xs">{p.fetch_duration_ms ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon, label, value, alert }: { icon: React.ReactNode; label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${alert ? "border-destructive bg-destructive/5" : "bg-muted/30"}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-bold ${alert ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
