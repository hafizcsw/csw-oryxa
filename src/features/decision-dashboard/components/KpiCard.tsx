import { Card, CardContent } from "@/components/ui/card";
import type { KpiPeriod } from "../types";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  periods: KpiPeriod[];
  loading: boolean;
}

export function KpiCard({ icon: Icon, label, periods, loading }: KpiCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="space-y-1">
          {periods.map((p, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{p.label}</span>
              <span className={`font-bold ${i === 0 ? "text-lg" : "text-xs text-muted-foreground"}`}>
                {loading ? "..." : (p.value ?? 0).toLocaleString("ar")}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
