import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SourceBadge } from "./SourceBadge";
import { isSameDomain, isDomainChanged } from "../utils/guards";
import { computeConversion, computeDropoff } from "../utils/mappers";
import type { FunnelStep } from "../types";

interface FunnelTableProps {
  steps: FunnelStep[];
  stepLabel: (s: string) => string;
}

export function FunnelTable({ steps, stepLabel }: FunnelTableProps) {
  const { t } = useTranslation("common");

  if (steps.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("dashboard.funnel.detailsTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-right p-2">{t("dashboard.funnel.step")}</th>
                <th className="text-right p-2">{t("dashboard.funnel.visitorsCol")}</th>
                <th className="text-right p-2">{t("dashboard.funnel.identityDomain")}</th>
                <th className="text-right p-2">{t("dashboard.funnel.countSource")}</th>
                <th className="text-right p-2">{t("dashboard.funnel.conversionPct")}</th>
                <th className="text-right p-2">{t("dashboard.funnel.dropoffPct")}</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step, i) => {
                const prev = i > 0 ? steps[i - 1] : step;
                const sameDomain = i === 0 || isSameDomain(step, prev);
                const domainChanged = i > 0 && isDomainChanged(step, prev);
                const convPct = computeConversion(step, prev, sameDomain);
                const dropPct = computeDropoff(step, prev, sameDomain);

                return (
                  <tr key={step.step} className={`border-b border-border/50 hover:bg-accent/30 ${domainChanged ? "border-t-2 border-t-amber-500/50" : ""}`}>
                    <td className="p-2 font-medium">{stepLabel(step.step)}</td>
                    <td className="p-2">{step.visitors.toLocaleString("ar")}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">
                        {step.identity_domain}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <SourceBadge source={step.count_source || 'events'} />
                    </td>
                    <td className="p-2">
                      {sameDomain ? (
                        <Badge variant={Number(convPct) > 50 ? "default" : Number(convPct) > 20 ? "secondary" : "destructive"} className="text-xs">
                          {convPct}%
                        </Badge>
                      ) : <span className="text-amber-500 text-[10px]">{t("dashboard.funnel.sourceMismatch")}</span>}
                    </td>
                    <td className="p-2">
                      {i > 0 && sameDomain && <span className="text-destructive text-xs">↓ {dropPct}%</span>}
                      {i > 0 && domainChanged && <span className="text-amber-500 text-[10px]">{t("dashboard.funnel.domainChanged")}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
