/**
 * OrxAdminStrip — Lightweight internal debug surface for ORX runtime state.
 * Hidden behind ?orx_debug=1 query param. Shows entity ORX state at a glance.
 */

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { OrxScore } from '@/types/orx';
import type { OrxExposureStatus } from '@/types/orxBetaGate';

interface OrxAdminStripProps {
  entityId: string | null | undefined;
  entityType: 'university' | 'program' | 'country';
  orxScore: OrxScore;
  exposureStatus: OrxExposureStatus;
  publishedFactsCount?: number;
  className?: string;
}

export function OrxAdminStrip({ entityId, entityType, orxScore, exposureStatus, publishedFactsCount, className }: OrxAdminStripProps) {
  const [searchParams] = useSearchParams();
  const isDebug = searchParams.get('orx_debug') === '1';

  if (!isDebug) return null;

  const rows: [string, string | number | null][] = [
    ['entity_id', entityId ?? 'N/A'],
    ['entity_type', entityType],
    ['status', orxScore.orx_status],
    ['score', orxScore.orx_score],
    ['confidence', orxScore.orx_confidence],
    ['exposure_status', exposureStatus],
    ['rank_global', orxScore.orx_rank_global],
    ['rank_country', orxScore.orx_rank_country],
    ['country_score', orxScore.orx_country_score],
    ['university_score', orxScore.orx_university_score],
    ['program_score', orxScore.orx_program_score],
    ['badges', orxScore.orx_badges.length > 0 ? orxScore.orx_badges.join(', ') : 'none'],
    ['published_facts', publishedFactsCount ?? '—'],
    ['methodology_version', orxScore.orx_methodology_version ?? 'N/A'],
    ['evaluated_at', orxScore.orx_last_evaluated_at ?? 'N/A'],
  ];

  return (
    <div className={cn(
      'border border-dashed border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-3 font-mono text-[11px]',
      className
    )}>
      <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase">
        <span>⚙ ORX Debug</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-1">
        {rows.map(([key, val]) => (
          <div key={key} className="flex gap-1.5">
            <span className="text-muted-foreground shrink-0">{key}:</span>
            <span className="text-foreground font-medium truncate">{val ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
