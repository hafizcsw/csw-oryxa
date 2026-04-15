import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, UserCheck, CreditCard, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FunnelVisualization } from "../components/FunnelVisualization";
import { FunnelTable } from "../components/FunnelTable";
import { SectionShell } from "../components/SectionShell";
import type { FunnelStep, FunnelGroup } from "../types";

interface FunnelSectionProps {
  funnel: FunnelStep[];
  funnels: FunnelGroup[];
}

const FUNNEL_ICONS: Record<string, React.ElementType> = {
  discovery: Search,
  account: UserCheck,
  revenue: CreditCard,
};

export function FunnelSection({ funnel, funnels }: FunnelSectionProps) {
  const { t } = useTranslation("common");
  const [activeFunnel, setActiveFunnel] = useState("discovery");

  const funnelStepLabel = (step: string) => t(`dashboard.funnel.steps.${step}`, step);
  const funnelNameLabel = (name: string) => t(`dashboard.funnel.funnelNames.${name}`, name);

  if (funnels.length === 0) {
    // Legacy single funnel fallback
    return (
      <SectionShell>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.funnel.title")}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{t("dashboard.funnel.identityWarning")}</p>
          </CardHeader>
          <CardContent>
            {funnel.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">{t("dashboard.noData")}</p>
            ) : (
              <FunnelVisualization steps={funnel} stepLabel={funnelStepLabel} />
            )}
          </CardContent>
        </Card>
      </SectionShell>
    );
  }

  const activeSteps = activeFunnel === "combined"
    ? funnel
    : (funnels.find(fg => fg.name === activeFunnel)?.steps || []);

  return (
    <SectionShell>
      {/* Funnel selector */}
      <div className="flex gap-2 flex-wrap">
        {funnels.map((fg) => {
          const Icon = FUNNEL_ICONS[fg.name] || Filter;
          return (
            <Button
              key={fg.name}
              variant={activeFunnel === fg.name ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFunnel(fg.name)}
              className="gap-1.5"
            >
              <Icon className="w-3.5 h-3.5" />
              {funnelNameLabel(fg.name)}
            </Button>
          );
        })}
        <Button
          variant={activeFunnel === "combined" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveFunnel("combined")}
          className="gap-1.5"
        >
          <Filter className="w-3.5 h-3.5" />
          {funnelNameLabel("combined")}
        </Button>
      </div>

      {/* Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {funnelNameLabel(activeFunnel)}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t("dashboard.funnel.identityWarning")}</p>
        </CardHeader>
        <CardContent>
          {activeSteps.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">{t("dashboard.noData")}</p>
          ) : (
            <FunnelVisualization steps={activeSteps} stepLabel={funnelStepLabel} />
          )}
        </CardContent>
      </Card>

      {/* Details table */}
      <FunnelTable steps={activeSteps} stepLabel={funnelStepLabel} />
    </SectionShell>
  );
}
