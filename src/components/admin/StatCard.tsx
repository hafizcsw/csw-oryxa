import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: "up" | "down";
}

export function StatCard({ title, value, hint, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:shadow-lg hover:border-primary/50">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>
        
        {/* Value */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground tracking-tight">{value}</span>
          {trend && (
            <span className={`text-xs font-semibold ${trend === 'up' ? 'text-success' : 'text-destructive'}`}>
              {trend === 'up' ? '↑' : '↓'}
            </span>
          )}
        </div>
        
        {/* Hint */}
        {hint && (
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  );
}
