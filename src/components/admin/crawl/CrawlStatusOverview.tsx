import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Globe, AlertCircle } from "lucide-react";

interface CrawlStatusOverviewProps {
  byStatus: Record<string, number>;
  withOfficialWebsite: number;
  withoutOfficialWebsite: number;
  bySource: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted",
  resolving: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  website_resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  discovery_done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  no_official_website: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  website_error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function CrawlStatusOverview({ byStatus, withOfficialWebsite, withoutOfficialWebsite, bySource }: CrawlStatusOverviewProps) {
  const { t } = useTranslation("common");

  const totalUniversities = Object.values(byStatus).reduce((sum, v) => sum + v, 0);

  const translateStatus = (status: string) => {
    const key = `admin.crawl.status.${status}`;
    const translated = t(key);
    return translated === key ? status : translated;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("admin.crawl.universityStatus")}
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {t("admin.crawl.totalUniversities")}: <strong className="text-foreground">{totalUniversities.toLocaleString()}</strong>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} className={`p-3 rounded-lg border ${STATUS_COLORS[status] || "bg-muted"}`}>
                <div className="text-xs font-medium opacity-70">{translateStatus(status)}</div>
                <div className="text-2xl font-bold">{count.toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-green-500" />
              <span className="text-sm">
                {t("admin.crawl.withWebsite")}: <strong>{withOfficialWebsite.toLocaleString()}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">
                {t("admin.crawl.withoutWebsite")}: <strong>{withoutOfficialWebsite.toLocaleString()}</strong>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {Object.keys(bySource).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("admin.crawl.sourceDistribution")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
                <div key={source} className="p-3 rounded-lg border bg-muted/50">
                  <div className="text-xs font-medium text-muted-foreground">{source}</div>
                  <div className="text-xl font-bold">{count.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
