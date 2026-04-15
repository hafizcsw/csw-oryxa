/**
 * UniversityRankingBadges — Compact inline ranking badges for university page header.
 * Shows ORX, QS, CWUR, UniRanks as pill badges.
 * ORX badge has a hover popover with score summary + "Learn more" opens Oriska chat.
 */
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, TrendingUp, Shield, ArrowRight, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChat } from '@/contexts/ChatContext';
import type { OrxScoreResult } from '@/hooks/useOrxScore';

interface RankingBadgesProps {
  orxData?: OrxScoreResult | null;
  qsWorldRank?: number | null;
  cwurWorldRank?: number | null;
  uniranksRank?: number | null;
  universityName?: string;
  className?: string;
}

export function UniversityRankingBadges({
  orxData,
  qsWorldRank,
  cwurWorldRank,
  uniranksRank,
  universityName,
  className,
}: RankingBadgesProps) {
  const { t } = useTranslation();
  const { open: openChat } = useChat();
  const [orxHover, setOrxHover] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasAnyRank = orxData || qsWorldRank || cwurWorldRank || uniranksRank;
  if (!hasAnyRank) return null;

  const handleOrxEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setOrxHover(true);
  };
  const handleOrxLeave = () => {
    hoverTimeout.current = setTimeout(() => setOrxHover(false), 200);
  };

  const handleLearnMore = () => {
    setOrxHover(false);
    const msg = universityName 
      ? t('orx.chat.askAbout', { university: universityName })
      : t('orx.chat.askGeneral');
    openChat(msg);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* ORX Badge with hover popover */}
      {orxData && (
        <div
          className="relative"
          onMouseEnter={handleOrxEnter}
          onMouseLeave={handleOrxLeave}
        >
          <button
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold",
              "border transition-all duration-200 cursor-default",
              orxData.orx_status === 'scored'
                ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15 hover:border-primary/50"
                : "bg-muted/50 border-border/50 text-muted-foreground"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ORX</span>
            {orxData.orx_status === 'scored' && orxData.orx_rank_global !== null && (
              <span className="font-black">#{orxData.orx_rank_global}</span>
            )}
            {orxData.orx_status === 'evaluating' && (
              <span className="text-[10px] font-normal opacity-70">{t('orx.card.evaluating.title')}</span>
            )}
          </button>

          {/* Hover Popover */}
          {orxHover && orxData.orx_status === 'scored' && (
            <div
              className={cn(
                "absolute top-full mt-2 z-50 w-72 p-4 rounded-xl",
                "bg-popover border border-border/60 shadow-lg",
                "animate-in fade-in-0 zoom-in-95 duration-200",
                "ltr:left-0 rtl:right-0"
              )}
              onMouseEnter={handleOrxEnter}
              onMouseLeave={handleOrxLeave}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{t('orx.brandName')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('orx.card.subtitle')}</p>
                </div>
              </div>

              {/* Score + Ranks */}
              <div className="flex items-end gap-4 mb-3">
                <div className="flex flex-col">
                  <span className="text-3xl font-black text-foreground leading-none">{orxData.orx_score}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{t('orx.card.outOf100')}</span>
                </div>
                <div className="flex flex-col gap-1 pb-0.5">
                  {orxData.orx_rank_global && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-primary" />
                      <span className="text-[11px] text-foreground/80">#{orxData.orx_rank_global} {t('orx.card.global')}</span>
                    </div>
                  )}
                  {orxData.orx_rank_country && (
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-foreground/80">#{orxData.orx_rank_country} {t('orx.card.inCountry')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Confidence */}
              {orxData.orx_confidence !== null && (
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">{t('orx.card.confidence')}</span>
                    <span className="text-[10px] font-semibold">{orxData.orx_confidence}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${orxData.orx_confidence}%` }} />
                  </div>
                </div>
              )}

              {/* Summary text */}
              {orxData.orx_summary && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-3">
                  {orxData.orx_summary}
                </p>
              )}

              {/* Learn more → opens Oriska chat */}
              <button
                onClick={handleLearnMore}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
              >
                {t('orx.card.learnMore')}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* QS World Rank Badge */}
      {qsWorldRank && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400">
          <Award className="w-3.5 h-3.5" />
          QS #{qsWorldRank}
        </span>
      )}

      {/* CWUR Badge */}
      {cwurWorldRank && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
          <Award className="w-3.5 h-3.5" />
          CWUR #{cwurWorldRank}
        </span>
      )}

      {/* UniRanks Badge */}
      {uniranksRank && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
          <Award className="w-3.5 h-3.5" />
          UniRanks #{uniranksRank}
        </span>
      )}
    </div>
  );
}
