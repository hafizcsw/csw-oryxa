import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Search, Globe, CheckCircle2, AlertTriangle, Clock,
  RefreshCw, Eye, TrendingUp, ShieldAlert, Zap, BarChart3,
} from "lucide-react";
import { OscCountrySection } from "./OscCountrySection";

interface CountrySummary {
  country_code: string;
  name_ar: string | null;
  name_en: string | null;
  university_count: number;
  avg_completeness: number | null;
  published_count: number;
  verifying_count: number;
  quarantined_count: number;
}

interface Counters {
  total: number;
  queued: number;
  processing: number;
  verifying: number;
  verified: number;
  published: number;
  quarantined: number;
  failed: number;
  special: number;
}

const EMPTY_COUNTERS: Counters = { total: 0, queued: 0, processing: 0, verifying: 0, verified: 0, published: 0, quarantined: 0, failed: 0, special: 0 };

export function ReviewQueue() {
  const { t } = useTranslation("common");
  const { toast } = useToast();
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [counters, setCounters] = useState<Counters>(EMPTY_COUNTERS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [countryFilter, setCountryFilter] = useState<string>("");

  const filters: Record<string, string> = {};
  if (statusFilter) filters.status = statusFilter;
  if (search.trim()) filters.search = search.trim();

  const fetchCountries = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase.rpc("rpc_admin_osc_review_countries" as any, {
        p_filters: filters,
      });
      if (error) throw error;
      const result = data as any;
      let countriesList = (result.countries || []) as CountrySummary[];
      if (countryFilter) {
        countriesList = countriesList.filter(c => c.country_code === countryFilter);
      }
      setCountries(countriesList);
      setCounters(result.counters || EMPTY_COUNTERS);
    } catch (err: any) {
      console.error("OSC review countries error:", err);
      toast({ title: "خطأ في تحميل البيانات", description: err.message, variant: "destructive" });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [statusFilter, search, countryFilter, toast]);

  useEffect(() => {
    const timer = setTimeout(fetchCountries, 300);
    return () => clearTimeout(timer);
  }, [fetchCountries]);

  useEffect(() => {
    const interval = setInterval(() => fetchCountries(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchCountries]);

  const totalUnis = countries.reduce((sum, c) => sum + c.university_count, 0);
  const publishRate = counters.total > 0 ? ((counters.published / counters.total) * 100).toFixed(1) : "0";

  const counterCards = [
    {
      icon: CheckCircle2,
      value: counters.published,
      label: "تم النشر",
      gradient: "from-emerald-500/10 to-green-500/5",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      valueColor: "text-emerald-700 dark:text-emerald-300",
      ring: "ring-emerald-500/20",
    },
    {
      icon: Eye,
      value: counters.verifying + counters.verified,
      label: "قيد التحقق",
      gradient: "from-amber-500/10 to-yellow-500/5",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-600 dark:text-amber-400",
      valueColor: "text-amber-700 dark:text-amber-300",
      ring: "ring-amber-500/20",
    },
    {
      icon: ShieldAlert,
      value: counters.quarantined,
      label: "حجر صحي",
      gradient: "from-rose-500/10 to-red-500/5",
      iconBg: "bg-rose-500/15",
      iconColor: "text-rose-600 dark:text-rose-400",
      valueColor: "text-rose-700 dark:text-rose-300",
      ring: "ring-rose-500/20",
    },
    {
      icon: Clock,
      value: counters.queued,
      label: "في الانتظار",
      gradient: "from-slate-500/10 to-gray-500/5",
      iconBg: "bg-slate-500/15",
      iconColor: "text-slate-500 dark:text-slate-400",
      valueColor: "text-slate-600 dark:text-slate-300",
      ring: "ring-slate-500/20",
    },
  ];

  return (
    <div className="space-y-5">
      {/* ── Hero Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {counterCards.map(({ icon: Icon, value, label, gradient, iconBg, iconColor, valueColor, ring }) => (
          <div
            key={label}
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${gradient} p-4 ring-1 ${ring} transition-all hover:shadow-md`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>
                  {value.toLocaleString("ar-EG")}
                </p>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
              </div>
              <div className={`rounded-lg p-2 ${iconBg}`}>
                <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
              </div>
            </div>
            {/* Decorative corner */}
            <div className={`absolute -bottom-3 -left-3 h-16 w-16 rounded-full ${iconBg} opacity-30 blur-xl`} />
          </div>
        ))}
      </div>

      {/* ── Summary Bar ── */}
      <div className="flex items-center justify-between rounded-xl border bg-card/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {totalUnis.toLocaleString("ar-EG")} جامعة
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs text-muted-foreground">
            {countries.length} دولة
          </span>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {publishRate}% نسبة النشر
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {counters.processing > 0 && (
            <Badge variant="secondary" className="gap-1 animate-pulse">
              <Zap className="h-3 w-3" />
              {counters.processing} يُعالج الآن
            </Badge>
          )}
          {counters.failed > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {counters.failed} فشل
            </Badge>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card/60 backdrop-blur-sm px-4 py-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="بحث بالاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-background/70"
          />
        </div>
        <Select value={countryFilter || "all"} onValueChange={(v) => setCountryFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[170px] bg-background/70">
            <Globe className="h-3.5 w-3.5 ml-1.5 text-muted-foreground" />
            <SelectValue placeholder="كل الدول" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الدول</SelectItem>
            {countries.map(c => (
              <SelectItem key={c.country_code} value={c.country_code}>
                {c.name_en || c.country_code} ({c.university_count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[170px] bg-background/70">
            <SelectValue placeholder="كل الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="queued">في الانتظار</SelectItem>
            <SelectItem value="verifying">قيد التحقق</SelectItem>
            <SelectItem value="verified">تم التحقق</SelectItem>
            <SelectItem value="published">تم النشر</SelectItem>
            <SelectItem value="published_partial">نشر جزئي</SelectItem>
            <SelectItem value="quarantined">حجر صحي</SelectItem>
            <SelectItem value="failed">فشل</SelectItem>
            <SelectItem value="special">خاص</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchCountries()}
          disabled={loading}
          className="shrink-0 hover:bg-primary/10"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* ── Country List ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary/60" />
          <p className="text-sm text-muted-foreground">جارٍ تحميل البيانات...</p>
        </div>
      ) : countries.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Globe className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">لا توجد نتائج</p>
        </div>
      ) : (
        <div className="space-y-2">
          {countries.map(country => (
            <OscCountrySection
              key={country.country_code}
              country={country}
              filters={filters}
            />
          ))}
        </div>
      )}
    </div>
  );
}
