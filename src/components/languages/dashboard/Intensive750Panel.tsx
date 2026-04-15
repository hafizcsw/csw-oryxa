import { AlertTriangle, CheckCircle2, Clock3, Flag, Layers3, ListChecks } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { DashboardPayload } from '@/types/russianExecutionPack';
import { translateLanguageCourseValue } from '@/lib/languageCourseI18n';

interface Props {
  dashboardData: DashboardPayload;
  compact?: boolean;
}

const statusTone: Record<string, string> = {
  on_track: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20',
  review_required: 'text-amber-700 bg-amber-500/10 border-amber-500/20',
  blocked_for_exam: 'text-rose-700 bg-rose-500/10 border-rose-500/20',
  ready_to_advance: 'text-primary bg-primary/10 border-primary/20',
};

export function Intensive750Panel({ dashboardData, compact = false }: Props) {
  const { t } = useLanguage();
  const intensive = dashboardData.intensive750;
  if (!intensive?.isActive) return null;

  const { dashboard, stageProgress, weeklyStatus, weeklyExamState, reviewRequiredState, intensiveReadinessState } = intensive;
  const formatRuntimeLabel = (value: string) => translateLanguageCourseValue(t, `languages.dashboard.runtimeLabels.${value}`, value);
  const stageLabel = (stageKey: string) => translateLanguageCourseValue(t, `languages.dashboard.intensive750.stageKeys.${stageKey}`, stageKey);
  const blockingReasonLabel = (reason: string) => translateLanguageCourseValue(t, `languages.dashboard.intensive750.blockingReasons.${reason}`, reason);

  return (
    <div className="space-y-3">
      <div className={cn('rounded-xl border p-4', statusTone[dashboard.weekStatus] ?? 'text-foreground bg-card border-border')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider">{t('languages.dashboard.intensive750.bannerLabel')}</p>
            <h3 className="mt-1 text-lg font-bold">
              {stageLabel(dashboard.stageKey)} · {t('languages.dashboard.intensive750.weekLabel', { week: dashboard.currentWeek })}
            </h3>
            <p className="mt-1 text-sm opacity-90">
              {t('languages.dashboard.intensive750.stageProgress', {
                completed: stageProgress.completedLessonCount,
                total: stageProgress.totalLessons,
                score: intensiveReadinessState.readinessScore,
              })}
            </p>
          </div>
          <div className="rounded-full border border-current/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            {formatRuntimeLabel(dashboard.weekStatus)}
          </div>
        </div>
      </div>

      <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4')}>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Layers3 className="h-4 w-4" />
            {t('languages.dashboard.intensive750.currentStage')}
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{stageLabel(stageProgress.stageKey)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('languages.dashboard.intensive750.lessonRange', { start: stageProgress.lessonRange.start, end: stageProgress.lessonRange.end })}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('languages.dashboard.intensive750.weekRange', { start: stageProgress.weekRange.start, end: stageProgress.weekRange.end })}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            {t('languages.dashboard.intensive750.weeklyExam')}
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{weeklyExamState.examKey}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('languages.dashboard.intensive750.statusLabel')}: {formatRuntimeLabel(weeklyExamState.status)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('languages.dashboard.intensive750.dueAfterLesson', { lesson: weeklyExamState.dueAfterLesson })}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListChecks className="h-4 w-4" />
            {t('languages.dashboard.intensive750.requiredReview')}
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{formatRuntimeLabel(reviewRequiredState.hasRequiredReview ? 'assigned' : 'clear')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('languages.dashboard.intensive750.reviewBlocks', { count: reviewRequiredState.reviewBlockIds.length })}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {reviewRequiredState.blockingReasons.length > 0
              ? reviewRequiredState.blockingReasons.map(blockingReasonLabel).join(' · ')
              : t('languages.dashboard.intensive750.noBlockingReasons')}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Flag className="h-4 w-4" />
            {t('languages.dashboard.intensive750.readyToAdvance')}
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{formatRuntimeLabel(dashboard.readinessToAdvance.nextWeekReady ? 'next_week_unlocked' : 'still_gated')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('languages.dashboard.intensive750.stageReady', {
              value: formatRuntimeLabel(dashboard.readinessToAdvance.nextStageReady ? 'yes' : 'no'),
            })}
          </p>
        </div>
      </div>

      <div className={cn('rounded-xl border border-border bg-card p-4', compact && 'hidden md:block')}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {reviewRequiredState.hasRequiredReview ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {t('languages.dashboard.intensive750.lessonsDueThisWeek')}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {dashboard.lessonsDueThisWeek.map((lesson) => (
            <span
              key={lesson.lessonRangeLabel}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium',
                lesson.status === 'completed' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
                lesson.status === 'review_required' && 'border-amber-500/30 bg-amber-500/10 text-amber-700',
                lesson.status === 'available' && 'border-primary/30 bg-primary/10 text-primary',
              )}
            >
              {lesson.lessonRangeLabel}
            </span>
          ))}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          {t('languages.dashboard.intensive750.currentWeekWindow', {
            start: weeklyStatus.lessonRange.start,
            end: weeklyStatus.lessonRange.end,
            status: formatRuntimeLabel(dashboard.finalExamReadiness.readinessStatus),
          })}
        </div>
      </div>
    </div>
  );
}
