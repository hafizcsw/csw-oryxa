import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, Zap, DollarSign, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReadinessResult, ReadinessVerdict, EligibilityPlan } from '@/features/readiness/types';

interface ReadinessSummaryRailProps {
  result: ReadinessResult;
  onViewPlan?: (planType: 'fastest' | 'cheapest' | 'best_fit') => void;
}

const VERDICT_CONFIG: Record<ReadinessVerdict, { icon: typeof CheckCircle2; colorClass: string; bgClass: string }> = {
  eligible_now: { icon: CheckCircle2, colorClass: 'text-green-500', bgClass: 'bg-green-500/10 border-green-500/30' },
  conditionally_eligible: { icon: AlertTriangle, colorClass: 'text-yellow-500', bgClass: 'bg-yellow-500/10 border-yellow-500/30' },
  not_eligible: { icon: XCircle, colorClass: 'text-red-500', bgClass: 'bg-red-500/10 border-red-500/30' },
  alternative_available: { icon: ArrowRight, colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10 border-blue-500/30' },
  data_unavailable: { icon: AlertTriangle, colorClass: 'text-muted-foreground', bgClass: 'bg-muted/50 border-border' },
};

export function ReadinessSummaryRail({ result, onViewPlan }: ReadinessSummaryRailProps) {
  const { t } = useLanguage();
  const config = VERDICT_CONFIG[result.verdict];
  const VerdictIcon = config.icon;
  const blockingGaps = result.gaps.filter(g => g.severity === 'blocking');

  return (
    <div className={cn('rounded-2xl border p-6 space-y-5', config.bgClass)}>
      {/* Verdict */}
      <div className="flex items-center gap-3">
        <VerdictIcon className={cn('h-8 w-8', config.colorClass)} />
        <div>
          <h3 className="text-xl font-bold text-foreground">{t(`readiness.verdict.${result.verdict}`)}</h3>
          <p className="text-sm text-muted-foreground">
            {blockingGaps.length > 0
              ? t('readiness.summary.blockers_count', { count: blockingGaps.length })
              : t('readiness.summary.no_blockers')}
          </p>
        </div>
      </div>

      {/* Top Blockers */}
      {blockingGaps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{t('readiness.summary.top_blockers')}</h4>
          <div className="space-y-1.5">
            {blockingGaps.slice(0, 3).map(gap => (
              <div key={gap.id} className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span className="text-foreground">{t(gap.title_key)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route Cards */}
      {(result.plans.fastest || result.plans.cheapest) && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{t('readiness.summary.routes')}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.plans.fastest && (
              <RouteCard
                icon={<Zap className="h-5 w-5 text-yellow-500" />}
                label={t('readiness.plans.fastest')}
                weeks={result.plans.fastest.total_estimated_weeks}
                onClick={() => onViewPlan?.('fastest')}
                t={t}
              />
            )}
            {result.plans.cheapest && (
              <RouteCard
                icon={<DollarSign className="h-5 w-5 text-green-500" />}
                label={t('readiness.plans.cheapest')}
                weeks={result.plans.cheapest.total_estimated_weeks}
                onClick={() => onViewPlan?.('cheapest')}
                t={t}
              />
            )}
          </div>
        </div>
      )}

      {/* Document Status */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t('readiness.summary.documents')}</span>
        <span className="font-medium text-foreground">
          {result.document_checklist.filter(d => d.status === 'uploaded').length} / {result.document_checklist.length}
        </span>
      </div>
    </div>
  );
}

function RouteCard({ icon, label, weeks, onClick, t }: {
  icon: React.ReactNode;
  label: string;
  weeks?: number;
  onClick?: () => void;
  t: (key: string, options?: Record<string, unknown>) => any;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors text-start"
    >
      {icon}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        {weeks != null && (
          <p className="text-xs text-muted-foreground">{t('readiness.summary.weeks', { count: weeks })}</p>
        )}
      </div>
    </button>
  );
}
