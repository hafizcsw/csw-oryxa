/**
 * OrxRankCard — Premium ORX RANK display for university/program pages.
 * 
 * States:
 * 1. Scored — shows score, rank, badges
 * 2. Evaluating — polished placeholder  
 * 3. Insufficient — distinct "not enough evidence" state
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TrendingUp, Clock, AlertCircle, ArrowRight, Sparkles, Shield, Zap } from 'lucide-react';
import { extractOrxScore, getOrxSubSignals, ORX_BADGE_CONFIG, type OrxScore, type OrxBadge } from '@/types/orx';
import { cn } from '@/lib/utils';

interface OrxRankCardProps {
  entity?: Record<string, any> | null | undefined;
  orxData?: OrxScore | null;
  className?: string;
  compact?: boolean;
}

export function OrxRankCard({ entity, orxData, className, compact = false }: OrxRankCardProps) {
  const { t } = useTranslation();
  const orx = orxData ?? extractOrxScore(entity);
  const subSignals = orxData
    ? getOrxSubSignals({ orx_country_score: orx.orx_country_score, orx_university_score: orx.orx_university_score, orx_program_score: orx.orx_program_score })
    : getOrxSubSignals(entity);
  const hasSubSignals = subSignals.some(s => s.available);

  return (
    <div className={cn(
      "orx-card relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300",
      "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lg)]",
      "dark:border-border/40 dark:bg-card/95",
      className
    )}>
      {/* Subtle mesh background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: 'var(--gradient-mesh)' }} />
      
      <div className="relative z-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-secondary text-secondary-foreground">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide uppercase text-foreground">{t('orx.brandName')}</h3>
              <p className="text-[11px] text-muted-foreground leading-tight">{t('orx.card.subtitle')}</p>
            </div>
          </div>
          {orx.orx_methodology_version && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">v{orx.orx_methodology_version}</span>
          )}
        </div>

        {/* Body — state-dependent */}
        {orx.orx_status === 'scored' && <ScoredState orx={orx} t={t} compact={compact} />}
        {orx.orx_status === 'evaluating' && <EvaluatingState t={t} />}
        {orx.orx_status === 'insufficient' && <InsufficientState t={t} />}

        {/* Sub-signals (only when available) */}
        {hasSubSignals && !compact && (
          <div className="mt-4 pt-4 border-t border-border/40">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">{t('orx.card.signals')}</p>
            <div className="grid grid-cols-2 gap-2">
              {subSignals.filter(s => s.available).map(signal => (
                <div key={signal.key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs text-foreground/80">{t(signal.label_key)}</span>
                  {signal.score !== null && (
                    <span className="ml-auto text-xs font-bold text-foreground">{signal.score}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer CTAs */}
        <div className="mt-4 pt-3 border-t border-border/30 flex items-center gap-3">
          <Link
            to="/orx-rank"
            className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            {t('orx.card.learnMore')} <ArrowRight className="w-3 h-3" />
          </Link>
          <Link
            to="/orx-rank/methodology"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('orx.card.methodology')}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Scored State ── */
function ScoredState({ orx, t, compact }: { orx: OrxScore; t: (k: string) => string; compact: boolean }) {
  return (
    <div>
      <div className="flex items-end gap-4 mb-3">
        {/* Big score */}
        <div className="flex flex-col">
          <span className="text-4xl font-black tracking-tight text-foreground leading-none">
            {orx.orx_score}
          </span>
          <span className="text-[10px] text-muted-foreground mt-1">{t('orx.card.outOf100')}</span>
        </div>

        {/* Rank info */}
        <div className="flex flex-col gap-1 pb-0.5">
          {orx.orx_rank_global && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-foreground/80">
                #{orx.orx_rank_global} {t('orx.card.global')}
              </span>
            </div>
          )}
          {orx.orx_rank_country && (
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-foreground/80">
                #{orx.orx_rank_country} {t('orx.card.inCountry')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Confidence bar */}
      {orx.orx_confidence !== null && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">{t('orx.card.confidence')}</span>
            <span className="text-[10px] font-semibold text-foreground">{orx.orx_confidence}%</span>
          </div>
          <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${orx.orx_confidence}%` }}
            />
          </div>
        </div>
      )}

      {/* Badges */}
      {orx.orx_badges.length > 0 && !compact && (
        <div className="flex flex-wrap gap-1.5">
          {orx.orx_badges.map((badge: OrxBadge) => {
            const config = ORX_BADGE_CONFIG[badge];
            return (
              <span
                key={badge}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold",
                  config.color
                )}
              >
                <Zap className="w-2.5 h-2.5" />
                {t(config.label_key)}
              </span>
            );
          })}
        </div>
      )}

      {/* Last evaluated */}
      {orx.orx_last_evaluated_at && (
        <div className="flex items-center gap-1 mt-2">
          <Clock className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground/60">
            {t('orx.card.lastEvaluated')}: {new Date(orx.orx_last_evaluated_at).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Evaluating State ── */
function EvaluatingState({ t }: { t: (k: string) => string }) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex items-center justify-center w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{t('orx.card.evaluating.title')}</p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            {t('orx.card.evaluating.description')}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['futureReadiness', 'adaptability', 'aiRelevance'].map(key => (
          <div key={key} className="flex flex-col items-center p-2 rounded-lg bg-muted/20 border border-border/20">
            <div className="w-6 h-1 rounded-full bg-muted/50 animate-pulse mb-1.5" />
            <span className="text-[10px] text-muted-foreground">{t(`orx.card.evaluating.${key}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Insufficient State ── */
function InsufficientState({ t }: { t: (k: string) => string }) {
  return (
    <div className="py-2">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/40">
          <AlertCircle className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t('orx.card.insufficient.title')}</p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
            {t('orx.card.insufficient.description')}
          </p>
        </div>
      </div>
    </div>
  );
}
