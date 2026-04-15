import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { TRUTH_BUCKETS } from "../dashboard.contract";
import type { TruthBuckets } from "../types";

interface TruthBucketCardProps {
  truthBuckets: TruthBuckets;
}

export function TruthBucketCards({ truthBuckets }: TruthBucketCardProps) {
  const { t } = useTranslation("common");
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {TRUTH_BUCKETS.map(b => {
        const bucket = truthBuckets[b.key as keyof TruthBuckets];
        return (
          <Card key={b.key} className="p-3">
            <p className={`text-xs font-medium ${b.color}`}>
              {t(`dashboard.overview.truthBuckets.${b.key}`)}
            </p>
            <p className="text-lg font-bold">
              {bucket?.visitors ?? 0}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {t("dashboard.overview.visitors")}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {bucket?.pageviews ?? 0} {t("dashboard.overview.pageviews")}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
