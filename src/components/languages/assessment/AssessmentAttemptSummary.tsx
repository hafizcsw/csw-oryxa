import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { RussianAssessmentLatestAttemptSummary } from '@/types/russianAssessmentExecution';

interface Props {
  latestAttempt: RussianAssessmentLatestAttemptSummary;
}

export function AssessmentAttemptSummary({ latestAttempt }: Props) {
  const { t } = useLanguage();

  if (!latestAttempt.attemptId) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {t('languages.assessment.noAttempts')}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('languages.assessment.latestAttempt')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
          latestAttempt.passed ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
        )}>
          {latestAttempt.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {latestAttempt.passed ? t('languages.assessment.resultPassed') : t('languages.assessment.resultNeedsRetry')}
        </span>
        {latestAttempt.percentScore !== null && (
          <span className="text-sm font-semibold text-foreground">{t('languages.assessment.scoreLabel', { score: latestAttempt.percentScore })}</span>
        )}
      </div>
      {latestAttempt.submittedAt && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{t('languages.assessment.submittedAtLabel', { date: new Date(latestAttempt.submittedAt).toLocaleString() })}</span>
        </div>
      )}
    </div>
  );
}
