import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface RunnerMetric {
  metric: string;
  value: number;
  created_at: string;
}

interface RunnerHealthMonitorProps {
  lastTickAt: string | null;
  isStale: boolean;
  lastMetrics: RunnerMetric[];
}

const METRIC_KEYS = ["pages_fetched", "pages_failed", "published", "extracted", "drafts_created", "urls_discovered"];

export function RunnerHealthMonitor({ lastTickAt, isStale, lastMetrics }: RunnerHealthMonitorProps) {
  const { t } = useTranslation("common");

  const translateMetric = (name: string) => {
    const key = `admin.crawl.metric.${name}`;
    const translated = t(key);
    return translated === key ? name : translated;
  };

  return (
    <Card className={isStale ? "border-yellow-500 bg-yellow-500/5" : "border-border"}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {isStale ? (
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          ) : (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          <span className="font-semibold">{t("admin.crawl.runner")}</span>
          {isStale && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
              {t("admin.crawl.stale")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
          <Clock className="h-3 w-3" />
          <span>
            {t("admin.crawl.lastTick")}:{" "}
            {lastTickAt ? new Date(lastTickAt).toLocaleString() : t("admin.crawl.never")}
          </span>
        </div>

        {lastMetrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {lastMetrics.slice(0, 6).map((m, i) => (
              <div key={i} className="text-xs bg-muted/50 rounded p-1.5 flex justify-between">
                <span className="text-muted-foreground">{translateMetric(m.metric)}</span>
                <span className="font-medium">{m.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
