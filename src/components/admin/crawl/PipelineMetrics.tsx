import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { BookOpen, FileText, Link, AlertTriangle } from "lucide-react";

interface PipelineError {
  stage: string;
  reason: string;
  created_at: string;
  trace_id: string | null;
}

interface PipelineMetricsProps {
  programsTotal: number;
  programsPublished: number;
  programsDraft: number;
  draftsByStatus: Record<string, number>;
  urlsByStatus: Record<string, number>;
  urlsByKind: Record<string, number>;
  errors: PipelineError[];
}

export function PipelineMetrics({
  programsTotal, programsPublished, programsDraft,
  draftsByStatus, urlsByStatus, urlsByKind, errors,
}: PipelineMetricsProps) {
  const { t } = useTranslation("common");

  const hasUrls = Object.keys(urlsByStatus).length > 0 || Object.keys(urlsByKind).length > 0;

  return (
    <div className="space-y-4">
      {/* Programs summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {t("admin.crawl.programs")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border">
              <div className="text-xs text-muted-foreground">{t("admin.crawl.total")}</div>
              <div className="text-2xl font-bold">{programsTotal.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20">
              <div className="text-xs text-green-700 dark:text-green-400">{t("admin.crawl.published")}</div>
              <div className="text-2xl font-bold text-green-600">{programsPublished.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20">
              <div className="text-xs text-yellow-700 dark:text-yellow-400">{t("admin.crawl.drafts")}</div>
              <div className="text-2xl font-bold text-yellow-600">{programsDraft.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drafts by status */}
      {Object.keys(draftsByStatus).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("admin.crawl.draftsByStatus")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(draftsByStatus).map(([status, count]) => (
                <div key={status} className="p-2 rounded border text-center">
                  <div className="text-xs text-muted-foreground">{status}</div>
                  <div className="text-lg font-bold">{count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* URLs - merged into one card */}
      {hasUrls && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link className="h-4 w-4" />
              {t("admin.crawl.urlsOverview")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.keys(urlsByStatus).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">{t("admin.crawl.urlsByStatus")}</h4>
                  <div className="space-y-1.5">
                    {Object.entries(urlsByStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                      <div key={status} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{status}</span>
                        <span className="font-medium">{count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(urlsByKind).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">{t("admin.crawl.urlsByKind")}</h4>
                  <div className="space-y-1.5">
                    {Object.entries(urlsByKind).sort((a, b) => b[1] - a[1]).map(([kind, count]) => (
                      <div key={kind} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{kind}</span>
                        <span className="font-medium">{count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Errors */}
      {errors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t("admin.crawl.recentErrors")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errors.map((e, i) => (
                <div key={i} className="p-2 border rounded text-xs bg-destructive/5">
                  <div className="flex justify-between">
                    <span className="font-medium">{e.stage}</span>
                    <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-muted-foreground mt-1 truncate">{e.reason}</p>
                  {e.trace_id && <p className="text-muted-foreground mt-0.5">tid: {e.trace_id}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
