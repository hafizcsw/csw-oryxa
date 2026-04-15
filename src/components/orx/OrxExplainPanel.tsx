/**
 * OrxExplainPanel — Shows ORX score explanation below OrxRankCard.
 * Only shows published/gated data. Never shows raw evidence or internal facts.
 */

import { useTranslation } from 'react-i18next';
import { Info, CheckCircle2, AlertTriangle, Clock, ShieldCheck, Layers, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrxScore } from '@/types/orx';
import type { OrxExposureStatus } from '@/types/orxBetaGate';
import { ORX_BADGE_CONFIG, type OrxBadge } from '@/types/orx';
import { extractOrxExplanation } from '@/lib/orxExplainability';

interface OrxExplainPanelProps {
  orxScore: OrxScore;
  exposureStatus: OrxExposureStatus;
  isBetaApproved: boolean;
  entityType: 'university' | 'program';
  className?: string;
}

export function OrxExplainPanel({ orxScore, exposureStatus, isBetaApproved, entityType, className }: OrxExplainPanelProps) {
  const { t } = useTranslation();

  // Don't render if no meaningful data
  if (orxScore.orx_status === 'insufficient' && !isBetaApproved) {
    return null;
  }

  const explanation = extractOrxExplanation(orxScore);
  const isScored = orxScore.orx_status === 'scored' && orxScore.orx_score !== null;
  const isEvaluating = orxScore.orx_status === 'evaluating';

  return (
    <Card className={cn('border-border/50 shadow-sm', className)}>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <h4 className="text-sm font-semibold text-foreground">
            {t('orx.explain.title')}
          </h4>
        </div>

        {/* Evaluating state */}
        {isEvaluating && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/30">
            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">{t('orx.explain.evaluating.title')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('orx.explain.evaluating.description')}</p>
            </div>
          </div>
        )}

        {/* Scored state — detailed explanation */}
        {isScored && (
          <>
            {/* Score summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ExplainStat label={t('orx.explain.stat.score')} value={String(orxScore.orx_score)} />
              {orxScore.orx_confidence !== null && (
                <ExplainStat label={t('orx.explain.stat.confidence')} value={`${orxScore.orx_confidence}%`} />
              )}
              {orxScore.orx_rank_global !== null && (
                <ExplainStat label={t('orx.explain.stat.globalRank')} value={`#${orxScore.orx_rank_global}`} />
              )}
              {orxScore.orx_rank_country !== null && (
                <ExplainStat label={t('orx.explain.stat.countryRank')} value={`#${orxScore.orx_rank_country}`} />
              )}
            </div>

            {/* Layer breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                {t('orx.explain.layers.title')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <LayerBar label={t('orx.explain.layers.country')} score={orxScore.orx_country_score} weight="20%" />
                <LayerBar label={t('orx.explain.layers.university')} score={orxScore.orx_university_score} weight="35%" />
                <LayerBar label={t('orx.explain.layers.program')} score={orxScore.orx_program_score} weight="45%" />
              </div>
            </div>

            {/* Top strengths */}
            {explanation.topStrengths.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {t('orx.explain.strengths.title')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {explanation.topStrengths.map(key => (
                    <Badge key={key} variant="outline" className="text-[11px] border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
                      {t(key)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Missing layers */}
            {explanation.missingLayers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  {t('orx.explain.missing.title')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {explanation.missingLayers.map(key => (
                    <Badge key={key} variant="outline" className="text-[11px] border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400">
                      {t(key)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Badges */}
            {orxScore.orx_badges.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {t('orx.explain.badges.title')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {orxScore.orx_badges.map((badge: OrxBadge) => {
                    const config = ORX_BADGE_CONFIG[badge];
                    return (
                      <Badge key={badge} variant="outline" className={cn('text-[11px]', config.color)}>
                        {t(config.label_key)}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Confidence & freshness notes */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                {t(explanation.confidenceNote)}
              </div>
              {explanation.freshnessNote && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {t(explanation.freshnessNote)}
                </div>
              )}
            </div>

            {/* Limited explanation fallback */}
            {!explanation.hasStructuredExplanation && (
              <p className="text-xs text-muted-foreground/70 italic">
                {t('orx.explain.limited')}
              </p>
            )}
          </>
        )}

        {/* Methodology reference */}
        <p className="text-[10px] text-muted-foreground/60 pt-1">
          {t('orx.explain.methodologyRef')}
        </p>
      </CardContent>
    </Card>
  );
}

function ExplainStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center p-2.5 rounded-lg bg-muted/30 border border-border/20">
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

function LayerBar({ label, score, weight }: { label: string; score: number | null; weight: string }) {
  const available = score !== null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-semibold text-foreground">{available ? score : '—'}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
        {available && (
          <div
            className="h-full rounded-full bg-primary/70 transition-all duration-500"
            style={{ width: `${Math.min(score!, 100)}%` }}
          />
        )}
      </div>
      <span className="text-[9px] text-muted-foreground/50">{weight}</span>
    </div>
  );
}
