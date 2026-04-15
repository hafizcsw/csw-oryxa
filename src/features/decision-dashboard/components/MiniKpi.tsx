import { Card, CardContent } from "@/components/ui/card";

interface MiniKpiProps {
  label: string;
  value?: any;
  highlight?: boolean;
  sublabel?: string;
}

export function MiniKpi({ label, value, highlight, sublabel }: MiniKpiProps) {
  return (
    <Card className={highlight ? "border-emerald-500/30 bg-emerald-500/5" : ""}>
      <CardContent className="p-3 text-center">
        <p className={`text-xl font-bold ${highlight ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
          {value ?? "—"}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sublabel && <p className="text-[9px] text-muted-foreground/70 mt-0.5">{sublabel}</p>}
        {highlight && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mx-auto mt-1" />}
      </CardContent>
    </Card>
  );
}
