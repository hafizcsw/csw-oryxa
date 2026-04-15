import { useLanguage } from '@/contexts/LanguageContext';
import { AlertTriangle, XCircle, Info, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { GapCard as GapCardType } from '@/features/readiness/types';

interface GapCardsProps {
  gaps: GapCardType[];
  onServiceClick?: (serviceId: string) => void;
}

const SEVERITY_CONFIG = {
  blocking: { icon: XCircle, color: 'text-red-500', border: 'border-red-500/30', bg: 'bg-red-500/5' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', border: 'border-yellow-500/30', bg: 'bg-yellow-500/5' },
  info: { icon: Info, color: 'text-blue-500', border: 'border-blue-500/30', bg: 'bg-blue-500/5' },
};

const COST_KEYS: Record<string, string> = {
  free: 'readiness.cost.free',
  low: 'readiness.cost.low',
  medium: 'readiness.cost.medium',
  high: 'readiness.cost.high',
};

export function GapCards({ gaps, onServiceClick }: GapCardsProps) {
  const { t } = useLanguage();

  if (gaps.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">{t('readiness.gaps.title')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {gaps.map(gap => {
          const config = SEVERITY_CONFIG[gap.severity];
          const Icon = config.icon;
          return (
            <div key={gap.id} className={cn('rounded-xl border p-4 space-y-3', config.border, config.bg)}>
              <div className="flex items-start gap-3">
                <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', config.color)} />
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-foreground">{t(gap.title_key)}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{t(gap.description_key)}</p>
                </div>
              </div>

              {/* Current vs Required */}
              {gap.current_value != null && gap.required_value != null && (
                <div className="flex items-center gap-4 text-sm bg-card/50 rounded-lg p-2">
                  <div>
                    <span className="text-muted-foreground">{t('readiness.gaps.current')}: </span>
                    <span className="font-medium text-foreground">{gap.current_value}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">{t('readiness.gaps.required')}: </span>
                    <span className="font-medium text-foreground">{gap.required_value}</span>
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {gap.estimated_time_weeks && (
                  <span>⏱ {t('readiness.summary.weeks', { count: gap.estimated_time_weeks })}</span>
                )}
                {gap.estimated_cost_band && (
                  <span>💰 {t(COST_KEYS[gap.estimated_cost_band])}</span>
                )}
              </div>

              {/* Action */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground">{t(gap.recommended_action_key)}</p>
                {gap.service_link && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => onServiceClick?.(gap.service_link!.service_id)}
                  >
                    {t(gap.service_link.label_key)}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
