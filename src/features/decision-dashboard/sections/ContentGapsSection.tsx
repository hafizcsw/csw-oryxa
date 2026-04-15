import { useTranslation } from "react-i18next";
import { AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RankedTable } from "../components/RankedTable";
import { SectionShell, SectionEmpty } from "../components/SectionShell";
import type { ContentGapsData } from "../types";

interface ContentGapsSectionProps {
  data: ContentGapsData | undefined;
}

export function ContentGapsSection({ data: gaps }: ContentGapsSectionProps) {
  const { t } = useTranslation("common");

  const hasNoData = !gaps?.universities_missing_tuition?.length
    && !gaps?.programs_missing_deadlines?.length
    && !gaps?.high_traffic_incomplete?.length;

  if (hasNoData) {
    return (
      <SectionShell>
        <SectionEmpty message={t("dashboard.noGaps")} />
      </SectionShell>
    );
  }

  return (
    <SectionShell>
      {gaps?.universities_missing_tuition && gaps.universities_missing_tuition.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {t("dashboard.gaps.missingTuitionTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RankedTable
              rows={gaps.universities_missing_tuition}
              columns={[
                { key: "name_ar", label: t("dashboard.gaps.university") },
                { key: "views", label: t("dashboard.gaps.views") },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {gaps?.programs_missing_deadlines && gaps.programs_missing_deadlines.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              {t("dashboard.gaps.missingDeadlinesTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RankedTable
              rows={gaps.programs_missing_deadlines}
              columns={[
                { key: "title", label: t("dashboard.gaps.program") },
                { key: "uni_name", label: t("dashboard.gaps.university") },
                { key: "views", label: t("dashboard.gaps.views") },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {gaps?.high_traffic_incomplete && gaps.high_traffic_incomplete.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("dashboard.gaps.highTrafficTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-right p-2">{t("dashboard.gaps.university")}</th>
                    <th className="text-right p-2">{t("dashboard.gaps.views")}</th>
                    <th className="text-right p-2">{t("dashboard.gaps.publishedPrograms")}</th>
                    <th className="text-right p-2">{t("dashboard.gaps.withTuition")}</th>
                    <th className="text-right p-2">{t("dashboard.gaps.coverage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.high_traffic_incomplete.map((r, i) => {
                    const coverage = r.published_programs > 0
                      ? Math.round((r.with_tuition / r.published_programs) * 100)
                      : 0;
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-accent/30">
                        <td className="p-2 font-medium">{r.name_ar}</td>
                        <td className="p-2">{r.views}</td>
                        <td className="p-2">{r.published_programs}</td>
                        <td className="p-2">{r.with_tuition}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${coverage > 70 ? "bg-emerald-500" : coverage > 30 ? "bg-amber-500" : "bg-destructive"}`}
                                style={{ width: `${coverage}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-10">{coverage}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </SectionShell>
  );
}
