import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Globe, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface BackfillStats {
  quarantined: number;
  totalInactive: number;
  recentlyFixed: number;
  totalActive: number;
  lastRunSamples: any[];
}

export function QuarantineBackfillMonitor() {
  const [stats, setStats] = useState<BackfillStats | null>(null);
  const [loading, setLoading] = useState(true);
  const prevRef = useRef<{ quarantined: number; time: number } | null>(null);
  const rateHistoryRef = useRef<number[]>([]);
  const [rate, setRate] = useState<number>(50); // default estimate

  const fetchStats = useCallback(async () => {
    try {
      // Parallel queries
      const [quarantinedRes, totalActiveRes, recentErrorsRes] = await Promise.all([
        supabase
          .from("universities")
          .select("id", { count: "exact", head: true })
          .is("country_id", null)
          .eq("is_active", false)
          .not("uniranks_profile_url", "is", null),
        supabase
          .from("universities")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        supabase
          .from("ingest_errors")
          .select("*")
          .eq("pipeline", "backfill_country")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const quarantined = quarantinedRes.count ?? 0;
      const totalActive = totalActiveRes.count ?? 0;
      const now = Date.now();

      // Calculate smoothed rate (moving average of last 4 samples)
      if (prevRef.current && prevRef.current.quarantined > quarantined) {
        const delta = prevRef.current.quarantined - quarantined;
        const minutes = (now - prevRef.current.time) / 60000;
        if (minutes > 0) {
          const instantRate = delta / minutes;
          const history = rateHistoryRef.current;
          history.push(instantRate);
          if (history.length > 4) history.shift();
          const avg = history.reduce((a, b) => a + b, 0) / history.length;
          setRate(Math.round(avg));
        }
      }
      prevRef.current = { quarantined, time: now };

      setStats({
        quarantined,
        totalInactive: quarantined,
        recentlyFixed: 0,
        totalActive,
        lastRunSamples: recentErrorsRes.data ?? [],
      });
    } catch (err) {
      console.error("Backfill monitor error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const total = 23199; // Original quarantine count at start
  const resolved = total - stats.quarantined;
  const progressPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const effectiveRate = rate > 0 ? rate : 50;
  const estimatedMinutesLeft = Math.ceil(stats.quarantined / effectiveRate);
  const estimatedHours = (estimatedMinutesLeft / 60).toFixed(1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            فك عزل الجامعات (Country Backfill)
          </CardTitle>
          <Badge variant={stats.quarantined === 0 ? "default" : "secondary"} className="gap-1">
            {stats.quarantined === 0 ? (
              <><CheckCircle2 className="h-3 w-3" /> مكتمل</>
            ) : (
              <><Clock className="h-3 w-3" /> قيد التشغيل</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">التقدم</span>
            <span className="font-mono font-medium">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>تم: {resolved.toLocaleString()}</span>
            <span>متبقي: {stats.quarantined.toLocaleString()}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{resolved.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">تم فك عزلها</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-orange-500">{stats.quarantined.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">لا تزال معزولة</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{stats.totalActive.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">إجمالي النشطة</div>
          </div>
        </div>

        {/* ETA */}
        {stats.quarantined > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded">
            <Clock className="h-4 w-4" />
            <span>
              الوقت المتوقع للانتهاء: ~{estimatedHours} ساعة ({estimatedMinutesLeft.toLocaleString()} دقيقة)
              — بمعدل {effectiveRate} جامعة/دقيقة
            </span>
          </div>
        )}

        {/* Recent errors */}
        {stats.lastRunSamples.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium text-orange-600">
              <AlertTriangle className="h-4 w-4" />
              آخر مشاكل غير مطابقة
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {stats.lastRunSamples.map((err: any, i: number) => (
                <div key={i} className="text-xs bg-muted/40 p-1.5 rounded flex justify-between">
                  <span className="truncate">{err.reason}</span>
                  <span className="text-muted-foreground font-mono">
                    {(err.details_json as any)?.country_code ?? "?"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          يتحدث تلقائياً كل 15 ثانية • pg_cron Job #17
        </p>
      </CardContent>
    </Card>
  );
}
