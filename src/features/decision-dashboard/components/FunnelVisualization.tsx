import { ArrowRight } from "lucide-react";
import type { FunnelStep } from "../types";

interface FunnelVisualizationProps {
  steps: FunnelStep[];
  stepLabel: (s: string) => string;
}

export function FunnelVisualization({ steps, stepLabel }: FunnelVisualizationProps) {
  const maxVisitors = Math.max(...steps.map((s) => s.visitors), 1);

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const prev = i > 0 ? steps[i - 1].visitors : step.visitors;
        const pct = maxVisitors > 0 ? (step.visitors / maxVisitors) * 100 : 0;
        const convPct = prev > 0 ? ((step.visitors / prev) * 100).toFixed(1) : "—";

        return (
          <div key={step.step} className="group">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium w-28 text-right truncate">
                {stepLabel(step.step)}
              </span>
              <div className="flex-1 h-8 bg-muted/50 rounded-lg overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-l from-primary to-primary/60 rounded-lg transition-all duration-500 flex items-center justify-end px-2"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                >
                  <span className="text-[10px] font-bold text-primary-foreground whitespace-nowrap">
                    {step.visitors.toLocaleString("ar")}
                  </span>
                </div>
              </div>
              {i > 0 && (
                <span className="text-[10px] text-muted-foreground w-14 text-left">
                  {convPct}%
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center mr-28 gap-1 py-0.5">
                <ArrowRight className="w-3 h-3 text-muted-foreground rotate-90" />
                <span className="text-[9px] text-destructive/70">
                  ↓ {prev > 0 ? (((prev - (steps[i + 1]?.visitors || 0)) / prev) * 100).toFixed(0) : 0}%
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
