import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { MiniKpi } from "../components/MiniKpi";
import { RankedTable } from "../components/RankedTable";
import { SectionShell } from "../components/SectionShell";
import { formatDuration } from "../utils/formatters";
import type { EngagementData, OverviewData } from "../types";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "hsl(var(--muted))"];

interface EngagementSectionProps {
  data: EngagementData | undefined;
  overview: OverviewData | undefined;
}

export function EngagementSection({ data: eng, overview: o }: EngagementSectionProps) {
  const { t } = useTranslation("common");

  return (
    <SectionShell>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MiniKpi label={t("dashboard.engagement.avgTime")} value={formatDuration(o?.avg_engaged_time_sec ?? 0, t)} />
        <MiniKpi label={t("dashboard.engagement.activeNow")} value={o?.active_now} highlight />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {eng?.device_breakdown && eng.device_breakdown.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("dashboard.engagement.deviceTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={eng.device_breakdown} dataKey="visitors" nameKey="device" cx="50%" cy="50%" outerRadius={70} label={({ device, visitors }) => `${device} (${visitors})`}>
                      {eng.device_breakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {eng?.hourly_pattern && eng.hourly_pattern.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("dashboard.engagement.hourlyTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eng.hourly_pattern}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hr" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip labelFormatter={(h) => `${h}:00`} />
                    <Bar dataKey="visitors" name={t("dashboard.engagement.visitors")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {eng?.top_pages_by_views && eng.top_pages_by_views.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("dashboard.engagement.topPagesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedTable
              rows={eng.top_pages_by_views}
              columns={[
                { key: "page_route", label: t("dashboard.engagement.page"), mono: true },
                { key: "views", label: t("dashboard.engagement.views") },
                { key: "unique_visitors", label: t("dashboard.engagement.uniqueVisitors") },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {eng?.top_exit_pages && eng.top_exit_pages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              {t("dashboard.engagement.exitPagesTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RankedTable
              rows={eng.top_exit_pages}
              columns={[
                { key: "page_route", label: t("dashboard.engagement.page"), mono: true },
                { key: "exit_count", label: t("dashboard.engagement.exitCount") },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </SectionShell>
  );
}
