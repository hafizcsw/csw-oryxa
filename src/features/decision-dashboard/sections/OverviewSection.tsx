import { useTranslation } from "react-i18next";
import { Users, Eye, UserPlus, Heart, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { KpiCard } from "../components/KpiCard";
import { MiniKpi } from "../components/MiniKpi";
import { TruthBucketCards } from "../components/TruthBucketCard";
import { SectionShell } from "../components/SectionShell";
import { formatDuration } from "../utils/formatters";
import type { OverviewData } from "../types";

interface OverviewSectionProps {
  data: OverviewData | undefined;
  loading: boolean;
}

export function OverviewSection({ data: o, loading }: OverviewSectionProps) {
  const { t } = useTranslation("common");

  return (
    <SectionShell>
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-300">
        {t("dashboard.overview.realOnlyNotice")}
      </div>

      {(o as any)?.truth_buckets && (
        <TruthBucketCards truthBuckets={(o as any).truth_buckets} />
      )}

      {(o as any)?.analytics_truth_started_at && (
        <p className="text-xs text-muted-foreground">
          📅 {t("dashboard.overview.cutoverLabel")}: {new Date((o as any).analytics_truth_started_at).toLocaleString("ar")}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Users} label={t("dashboard.kpi.visitors")} periods={[
          { label: t("dashboard.kpi.h24"), value: o?.visitors_24h },
          { label: t("dashboard.kpi.d7"), value: o?.visitors_7d },
          { label: t("dashboard.kpi.d30"), value: o?.visitors_30d },
        ]} loading={loading} />
        <KpiCard icon={Eye} label={t("dashboard.kpi.pageviews")} periods={[
          { label: t("dashboard.kpi.h24"), value: o?.pageviews_24h },
          { label: t("dashboard.kpi.d7"), value: o?.pageviews_7d },
          { label: t("dashboard.kpi.d30"), value: o?.pageviews_30d },
        ]} loading={loading} />
        <KpiCard icon={UserPlus} label={t("dashboard.kpi.registrations")} periods={[
          { label: t("dashboard.kpi.h24"), value: o?.registrations_24h },
          { label: t("dashboard.kpi.d7"), value: o?.registrations_7d },
          { label: t("dashboard.kpi.d30"), value: o?.registrations_30d },
        ]} loading={loading} />
        <KpiCard icon={Heart} label={t("dashboard.kpi.shortlist")} periods={[
          { label: t("dashboard.kpi.h24"), value: o?.shortlist_adds_24h },
          { label: t("dashboard.kpi.d7"), value: o?.shortlist_adds_7d },
          { label: t("dashboard.kpi.d30"), value: o?.shortlist_adds_30d },
        ]} loading={loading} />
        <KpiCard icon={FileText} label={t("dashboard.kpi.applications")} periods={[
          { label: t("dashboard.kpi.h24"), value: o?.application_starts_24h },
          { label: t("dashboard.kpi.d7"), value: o?.application_starts_7d },
        ]} loading={loading} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniKpi label={t("dashboard.kpi.activeNow")} value={o?.active_now} highlight />
        {(o?.returning_visitors_pct ?? 0) > 0 && (
          <MiniKpi label={t("dashboard.kpi.returningPct")} value={`${o?.returning_visitors_pct}%`} />
        )}
        <MiniKpi
          label={t("dashboard.kpi.avgTime")}
          value={formatDuration(o?.avg_engaged_time_sec ?? 0, t)}
          sublabel={o?.engaged_time_source === 'heartbeat' ? t("dashboard.engagement.heartbeat") : t("dashboard.engagement.sessionEstimate")}
        />
        <MiniKpi label={t("dashboard.kpi.chatsToday")} value={o?.chat_sessions_24h} />
        <MiniKpi label={t("dashboard.kpi.docsToday")} value={o?.doc_uploads_24h} />
      </div>

      {o?.daily_trend && o.daily_trend.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("dashboard.overview.trendTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={o.daily_trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString("ar", { day: "numeric", month: "short" })} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip labelFormatter={(d) => new Date(d).toLocaleDateString("ar", { day: "numeric", month: "long" })} />
                  <Area type="monotone" dataKey="visitors" name={t("dashboard.overview.visitors")} fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Area type="monotone" dataKey="pageviews" name={t("dashboard.overview.pageviews")} fill="hsl(var(--accent) / 0.1)" stroke="hsl(var(--accent))" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </SectionShell>
  );
}
