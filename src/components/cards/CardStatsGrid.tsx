import { LucideIcon } from "lucide-react";

export interface StatItem {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconColor?: string;
}

interface CardStatsGridProps {
  stats: StatItem[];
  columns?: 2 | 3;
}

export function CardStatsGrid({ stats, columns = 2 }: CardStatsGridProps) {
  return (
    <div className={`grid ${columns === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'} gap-3`}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/40 hover:bg-muted/50 transition-all"
          >
            <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${stat.iconColor || 'text-primary'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground/90 font-medium mb-1">{stat.label}</p>
              <p className="text-sm font-bold text-foreground truncate">{stat.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
