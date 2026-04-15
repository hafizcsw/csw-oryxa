/**
 * Scholarship / Deadline / Cost Decision Block
 * Structured decision-oriented blocks for program pages
 */
import { useTranslation } from 'react-i18next';
import { DollarSign, Calendar, Clock, Award, AlertTriangle, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ScholarshipBlock {
  name: string;
  amount?: string | null;
  type?: string; // merit | need | full | partial
  deadline?: string | null;
  eligibility?: string | null;
}

interface CostBlock {
  tuition_yearly?: number | null;
  living_monthly?: number | null;
  currency?: string;
  total_estimated_yearly?: number | null;
}

interface DeadlineBlock {
  intake: string;
  deadline?: string | null;
  days_remaining?: number | null;
  status: 'open' | 'closing_soon' | 'closed' | 'upcoming';
}

export interface DecisionBlockData {
  scholarships?: ScholarshipBlock[];
  cost?: CostBlock;
  deadlines?: DeadlineBlock[];
  housing_monthly?: number | null;
  housing_currency?: string;
}

interface DecisionBlocksProps {
  data: DecisionBlockData;
  className?: string;
}

export function DecisionBlocks({ data, className }: DecisionBlocksProps) {
  const { t } = useTranslation();

  const hasContent = data.scholarships?.length || data.cost || data.deadlines?.length;
  if (!hasContent) return null;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Deadline Urgency */}
      {data.deadlines && data.deadlines.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {t('decision.deadlines_title')}
          </h4>
          <div className="space-y-2">
            {data.deadlines.map((d, i) => {
              const isUrgent = d.status === 'closing_soon';
              const isClosed = d.status === 'closed';
              return (
                <div key={i} className={cn(
                  'flex items-center justify-between p-3 rounded-xl border text-sm',
                  isUrgent ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20' :
                  isClosed ? 'border-border bg-muted/50 opacity-60' :
                  'border-border bg-card'
                )}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground">{d.intake}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.deadline && (
                      <span className="text-muted-foreground text-xs">
                        {new Date(d.deadline).toLocaleDateString()}
                      </span>
                    )}
                    {d.days_remaining != null && d.days_remaining > 0 && (
                      <Badge variant={isUrgent ? 'destructive' : 'secondary'} className="text-xs">
                        {d.days_remaining} {t('decision.days_left')}
                      </Badge>
                    )}
                    <Badge variant={isClosed ? 'outline' : isUrgent ? 'destructive' : d.status === 'open' ? 'default' : 'secondary'} className="text-xs">
                      {t(`decision.status_${d.status}`)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cost Band */}
      {data.cost && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            {t('decision.cost_title')}
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {data.cost.tuition_yearly != null && (
              <div className="p-3 rounded-xl bg-muted/50 space-y-1">
                <span className="text-xs text-muted-foreground">{t('decision.tuition_yearly')}</span>
                <p className="text-lg font-bold text-foreground">
                  {data.cost.tuition_yearly.toLocaleString()} {data.cost.currency || 'USD'}
                </p>
              </div>
            )}
            {data.cost.living_monthly != null && (
              <div className="p-3 rounded-xl bg-muted/50 space-y-1">
                <span className="text-xs text-muted-foreground">{t('decision.living_monthly')}</span>
                <p className="text-lg font-bold text-foreground">
                  {data.cost.living_monthly.toLocaleString()} {data.cost.currency || 'USD'}
                </p>
              </div>
            )}
            {data.housing_monthly != null && (
              <div className="p-3 rounded-xl bg-muted/50 space-y-1">
                <span className="text-xs text-muted-foreground">{t('decision.housing_monthly')}</span>
                <p className="text-lg font-bold text-foreground">
                  {data.housing_monthly.toLocaleString()} {data.housing_currency || data.cost.currency || 'USD'}
                </p>
              </div>
            )}
            {data.cost.total_estimated_yearly != null && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                <span className="text-xs text-muted-foreground">{t('decision.total_yearly')}</span>
                <p className="text-lg font-bold text-primary">
                  {data.cost.total_estimated_yearly.toLocaleString()} {data.cost.currency || 'USD'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scholarships */}
      {data.scholarships && data.scholarships.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            {t('decision.scholarships_title')}
          </h4>
          <div className="space-y-2">
            {data.scholarships.map((s, i) => (
              <div key={i} className="p-3 rounded-xl border border-border bg-muted/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">{s.name}</span>
                  {s.type && (
                    <Badge variant="outline" className="text-xs capitalize">{t(`decision.scholarship_${s.type}`)}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {s.amount && <span className="font-medium text-foreground">{s.amount}</span>}
                  {s.deadline && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(s.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {s.eligibility && (
                  <p className="text-xs text-muted-foreground">{s.eligibility}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
