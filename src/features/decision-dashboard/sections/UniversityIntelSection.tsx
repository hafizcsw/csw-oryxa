import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RankedTable } from "../components/RankedTable";
import { SectionShell } from "../components/SectionShell";
import type { UniversityIntelData } from "../types";

interface UniversityIntelSectionProps {
  data: UniversityIntelData | undefined;
}

export function UniversityIntelSection({ data: uni }: UniversityIntelSectionProps) {
  const { t } = useTranslation("common");

  return (
    <SectionShell>
      {uni?.data_source && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {t("dashboard.university.dataSource")}: {
              uni.data_source.includes('blended') ? t("dashboard.university.blendedSource") :
              uni.data_source === 'entity_view_events' ? t("dashboard.university.entityEvents") :
              t("dashboard.university.routeFallback")
            }
          </Badge>
        </div>
      )}

      {uni?.top_by_views && uni.top_by_views.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("dashboard.university.topViewsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedTable
              rows={uni.top_by_views}
              columns={[
                { key: "name_ar", label: t("dashboard.university.name") },
                { key: "views", label: t("dashboard.university.views") },
                { key: "unique_visitors", label: t("dashboard.university.uniqueVisitors") },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {uni?.top_by_shortlist && uni.top_by_shortlist.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("dashboard.university.topShortlistTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedTable
              rows={uni.top_by_shortlist}
              columns={[
                { key: "name_ar", label: t("dashboard.university.name") },
                { key: "adds", label: t("dashboard.university.adds") },
                { key: "unique_users", label: t("dashboard.university.users") },
              ]}
            />
          </CardContent>
        </Card>
      )}

      {uni?.top_programs_by_views && uni.top_programs_by_views.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("dashboard.university.topProgramsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedTable
              rows={uni.top_programs_by_views}
              columns={[
                { key: "program_title", label: t("dashboard.university.program") },
                { key: "university_name", label: t("dashboard.university.name") },
                { key: "views", label: t("dashboard.university.views") },
                { key: "unique_visitors", label: t("dashboard.university.visitors") },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </SectionShell>
  );
}
