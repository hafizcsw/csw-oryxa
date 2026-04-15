import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Play, Square } from "lucide-react";

type LastRun = {
  at?: string;
  props?: Record<string, any>;
};

function badge(color: "green" | "yellow" | "red" | "gray", text: string) {
  const cls =
    color === "green" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" :
    color === "yellow" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" :
    color === "red" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  return <span className={`px-2 py-1 text-xs rounded ${cls}`}>{text}</span>;
}

function since(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

function parseStatus(props?: Record<string, any>) {
  if (!props) return { color: "gray", text: "no data" } as const;
  if (props.error || props.ok === false) return { color: "red", text: "error" } as const;
  if (props.skipped || props.reason === "flag_off") return { color: "yellow", text: "skipped" } as const;
  return { color: "green", text: "success" } as const;
}

export default function CronJobsCard() {
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [gscJob, setGscJob] = useState(false);
  const [blJob, setBlJob] = useState(false);
  const [wantGsc, setWantGsc] = useState(true);
  const [wantBl, setWantBl] = useState(true);
  const [enable, setEnable] = useState(true);
  const [runningGsc, setRunningGsc] = useState(false);
  const [runningBl, setRunningBl] = useState(false);
  const [lastGsc, setLastGsc] = useState<LastRun>({});
  const [lastBl, setLastBl] = useState<LastRun>({});

  async function load() {
    setLoading(true);
    try {
      const { data: status, error: e1 } = await supabase.rpc("seo_cron_status");
      if (e1) throw e1;
      
      const result = status as any;
      setGscJob(!!result?.gsc_job);
      setBlJob(!!result?.backlinks_job);
      
      const flags = result?.flags || {};
      setWantGsc(flags?.gsc_sync_enabled !== "false");
      setWantBl(flags?.backlinks_auto_import_enabled !== "false");

      const { data: last, error: e2 } = await supabase.rpc("seo_last_runs");
      if (e2) throw e2;
      setLastGsc((last as any)?.gsc || {});
      setLastBl((last as any)?.backlinks || {});
    } catch (e: any) {
      console.error("[CronJobsCard] Load error:", e);
      toast.error("Failed to load cron status");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    setApplying(true);
    try {
      const { data, error } = await supabase.rpc("seo_cron_apply", {
        _enable: enable,
        _gsc: wantGsc,
        _backlinks: wantBl
      });
      
      if (error) throw error;
      
      const result = data as any;
      toast.success(enable ? "Cron jobs enabled/updated" : "Cron jobs disabled");
      setGscJob(!!result?.gsc_job);
      setBlJob(!!result?.backlinks_job);
      
      await supabase.from("events").insert({
        name: "seo_cron_applied",
        properties: { enable, wantGsc, wantBl }
      });
    } catch (e: any) {
      console.error("[CronJobsCard] Apply error:", e);
      toast.error("Apply failed: " + e.message);
    } finally {
      setApplying(false);
    }
  }

  async function runGscNow() {
    setRunningGsc(true);
    try {
      const { error } = await supabase.functions.invoke("gsc-sync", {
        body: { reason: "manual" }
      });
      if (error) throw error;
      toast.success("GSC sync started");
      await supabase.from("events").insert({
        name: "seo_gsc_run_now_clicked",
        properties: { ok: true }
      });
      setTimeout(load, 3000);
    } catch (e: any) {
      toast.error("GSC failed: " + e.message);
      await supabase.from("events").insert({
        name: "seo_gsc_run_now_clicked",
        properties: { ok: false, error: String(e?.message || e) }
      });
    } finally {
      setRunningGsc(false);
    }
  }

  async function runBacklinksNow() {
    setRunningBl(true);
    try {
      const { error } = await supabase.functions.invoke("backlinks-auto-import", {
        body: { reason: "manual" }
      });
      if (error) throw error;
      toast.success("Backlinks import started");
      await supabase.from("events").insert({
        name: "seo_backlinks_run_now_clicked",
        properties: { ok: true }
      });
      setTimeout(load, 3000);
    } catch (e: any) {
      toast.error("Backlinks failed: " + e.message);
      await supabase.from("events").insert({
        name: "seo_backlinks_run_now_clicked",
        properties: { ok: false, error: String(e?.message || e) }
      });
    } finally {
      setRunningBl(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const gscStatus = useMemo(() => parseStatus(lastGsc?.props), [lastGsc]);
  const blStatus = useMemo(() => parseStatus(lastBl?.props), [lastBl]);

  return (
    <Card className="p-6" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">مهام SEO التلقائية</h3>
          <p className="text-sm text-muted-foreground">
            GSC يوميًا (03:05 UTC) · Backlinks كل ساعة (:15) — مع آخر نتيجة تشغيل
          </p>
        </div>
        <Button
          onClick={load}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        {/* GSC Job Status */}
        <Card className="p-4 bg-secondary/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-muted-foreground">مهمة GSC</div>
              <div className="font-medium">{gscJob ? "مجدولة" : "غير مجدولة"}</div>
            </div>
            <span className={`px-2 py-1 text-xs rounded ${
              gscJob ? "bg-green-100 text-green-700 dark:bg-green-950" : "bg-gray-100 text-gray-700"
            }`}>
              {gscJob ? "تعمل" : "متوقفة"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="wantGsc"
              checked={wantGsc}
              onCheckedChange={(checked) => setWantGsc(!!checked)}
            />
            <Label htmlFor="wantGsc" className="text-sm cursor-pointer">
              تضمين عند التطبيق
            </Label>
          </div>
          <Button
            onClick={runGscNow}
            disabled={runningGsc}
            variant="outline"
            size="sm"
            className="w-full mt-3"
          >
            {runningGsc ? "جاري التشغيل…" : "تشغيل الآن"}
          </Button>

          {/* آخر نتيجة */}
          <div className="mt-3 text-sm border-t pt-3">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">آخر تشغيل</div>
              {badge(gscStatus.color as any, gscStatus.text)}
            </div>
            <div className="text-foreground mt-1">
              {lastGsc?.at ? since(lastGsc.at) : "—"}
            </div>
            {lastGsc?.props?.message && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {lastGsc.props.message}
              </div>
            )}
          </div>
        </Card>

        {/* Backlinks Job Status */}
        <Card className="p-4 bg-secondary/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-muted-foreground">مهمة الباكلينكس</div>
              <div className="font-medium">{blJob ? "مجدولة" : "غير مجدولة"}</div>
            </div>
            <span className={`px-2 py-1 text-xs rounded ${
              blJob ? "bg-green-100 text-green-700 dark:bg-green-950" : "bg-gray-100 text-gray-700"
            }`}>
              {blJob ? "تعمل" : "متوقفة"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="wantBl"
              checked={wantBl}
              onCheckedChange={(checked) => setWantBl(!!checked)}
            />
            <Label htmlFor="wantBl" className="text-sm cursor-pointer">
              تضمين عند التطبيق
            </Label>
          </div>
          <Button
            onClick={runBacklinksNow}
            disabled={runningBl}
            variant="outline"
            size="sm"
            className="w-full mt-3"
          >
            {runningBl ? "جاري التشغيل…" : "تشغيل الآن"}
          </Button>

          {/* آخر نتيجة */}
          <div className="mt-3 text-sm border-t pt-3">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">آخر تشغيل</div>
              {badge(blStatus.color as any, blStatus.text)}
            </div>
            <div className="text-foreground mt-1">
              {lastBl?.at ? since(lastBl.at) : "—"}
            </div>
            {lastBl?.props?.message && (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {lastBl.props.message}
              </div>
            )}
          </div>
        </Card>

        {/* Master Control */}
        <Card className="p-4 bg-primary/5">
          <div className="text-sm text-muted-foreground mb-3">التحكم الرئيسي</div>
          <div className="flex items-center gap-2 mb-3">
            <Checkbox
              id="enable"
              checked={enable}
              onCheckedChange={(checked) => setEnable(!!checked)}
            />
            <Label htmlFor="enable" className="text-sm cursor-pointer">
              {enable ? "تفعيل المهام" : "إيقاف المهام"}
            </Label>
          </div>
          <Button
            onClick={apply}
            className="w-full"
            disabled={applying || loading}
            variant={enable ? "default" : "destructive"}
          >
            {enable ? (
              <><Play className="h-4 w-4 ml-2" />تطبيق التفعيل</>
            ) : (
              <><Square className="h-4 w-4 ml-2" />تطبيق الإيقاف</>
            )}
          </Button>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        * "تشغيل الآن" يستدعي الدوال فورًا (تحترم system_flags). "آخر تشغيل" يُحدَّث تلقائيًا كل 30 ثانية أو بعد التشغيل.
      </p>
    </Card>
  );
}
