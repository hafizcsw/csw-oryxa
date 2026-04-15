import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MiniKpi } from "../components/MiniKpi";
import { RankedTable } from "../components/RankedTable";
import { SectionShell } from "../components/SectionShell";
import type { SearchIntelData } from "../types";

interface SearchSectionProps {
  data: SearchIntelData | undefined;
}

export function SearchSection({ data: srch }: SearchSectionProps) {
  const { t } = useTranslation("common");

  return (
    <SectionShell>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniKpi label={t("dashboard.search.totalSearches")} value={srch?.total_searches_30d?.toLocaleString("ar")} />
        {(srch?.search_to_click_pct ?? 0) > 0 && (
          <MiniKpi label={t("dashboard.search.searchToClick")} value={`${srch?.search_to_click_pct}%`} />
        )}
        {(srch?.search_to_shortlist_pct ?? 0) > 0 && (
          <MiniKpi
            label={t("dashboard.search.searchToShortlist")}
            value={`${srch?.search_to_shortlist_pct}%`}
            sublabel={srch?.attribution_method === 'visitor_proxy' ? t("dashboard.search.attributionProxy") : undefined}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {srch?.top_country_filters && srch.top_country_filters.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("dashboard.search.topCountries")}</CardTitle>
            </CardHeader>
            <CardContent>
              <RankedTable
                rows={srch.top_country_filters}
                columns={[
                  { key: "filter_val", label: t("dashboard.search.country") },
                  { key: "uses", label: t("dashboard.search.times") },
                  { key: "unique_users", label: t("dashboard.search.users") },
                ]}
              />
            </CardContent>
          </Card>
        )}

        {srch?.top_degree_filters && srch.top_degree_filters.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("dashboard.search.topDegrees")}</CardTitle>
            </CardHeader>
            <CardContent>
              <RankedTable
                rows={srch.top_degree_filters}
                columns={[
                  { key: "filter_val", label: t("dashboard.search.degree") },
                  { key: "uses", label: t("dashboard.search.times") },
                ]}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </SectionShell>
  );
}
