// ═══════════════════════════════════════════════════════════════
// DocAssemblyHeader — surface-visible truth strip for one doc
// ═══════════════════════════════════════════════════════════════
// Truth comes from the artifact first (chosen_route, parser_used,
// failure_reason). Analysis values (parser_type) are secondary.
// reading_route and destination_lane are SEPARATE concepts.
// ═══════════════════════════════════════════════════════════════

import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { ReadingArtifact } from '@/features/documents/reading-artifact-model';
import type { DocumentAnalysis } from '@/features/documents/document-analysis-model';
import type { DestinationLane } from '@/features/documents/assembly-field-templates';

interface DocAssemblyHeaderProps {
  destinationLane: DestinationLane;
  artifact: ReadingArtifact | null;
  analysis: DocumentAnalysis | null;
  routeReason?: string | null;
}

const DASH = '—';

export function DocAssemblyHeader({
  destinationLane,
  artifact,
  analysis,
  routeReason,
}: DocAssemblyHeaderProps) {
  const { t } = useLanguage();

  const chosenRoute = artifact?.chosen_route ?? null; // reading route truth
  const parserUsed = artifact?.parser_used ?? null;   // artifact truth
  const failureReason = artifact?.failure_reason ?? null;

  const parserType = analysis?.parser_type ?? null;
  const showParserTypeSecondary =
    parserType && parserType !== 'none' && String(parserType) !== String(parserUsed);

  const conf = analysis ? Math.round((analysis.classification_confidence ?? 0) * 100) : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      <Pill
        label={t('portal.assembly.header.lane')}
        value={t(`portal.assembly.lane.${destinationLane}`)}
        tone="primary"
      />
      <Pill
        label={t('portal.assembly.header.reading_route')}
        value={chosenRoute ? t(`portal.assembly.reading_route.${chosenRoute}`) : DASH}
        tone={chosenRoute ? 'neutral' : 'muted'}
      />
      <Pill
        label={t('portal.assembly.header.parser_used')}
        value={parserUsed && parserUsed !== 'none' ? parserUsed : DASH}
        tone={parserUsed && parserUsed !== 'none' ? 'neutral' : 'muted'}
      />
      {analysis?.classification_result && (
        <Pill
          label={t('portal.assembly.header.classification')}
          value={`${t(`portal.assembly.classification.${analysis.classification_result}`)} · ${conf}%`}
          tone="neutral"
        />
      )}
      {analysis && (
        <Pill
          label={t('portal.assembly.header.readability')}
          value={t(`portal.assembly.readability.${analysis.readability_status}`)}
          tone={analysis.readability_status === 'readable' ? 'ok' : analysis.readability_status === 'unreadable' ? 'bad' : 'warn'}
        />
      )}
      {failureReason && (
        <Pill
          label={t('portal.assembly.header.failure_reason')}
          value={t(`portal.assembly.failure_reason.${failureReason}`)}
          tone="bad"
        />
      )}
      {routeReason && (
        <Pill
          label={t('portal.assembly.header.route_reason')}
          value={t(`portal.assembly.route_reason.${routeReason}`)}
          tone="warn"
        />
      )}
      {showParserTypeSecondary && (
        <Pill
          label={t('portal.assembly.header.parser_type')}
          value={parserType!}
          tone="muted"
          dim
        />
      )}
    </div>
  );
}

function Pill({
  label,
  value,
  tone,
  dim,
}: {
  label: string;
  value: string;
  tone: 'primary' | 'neutral' | 'ok' | 'warn' | 'bad' | 'muted';
  dim?: boolean;
}) {
  const toneCls = {
    primary: 'border-primary/30 bg-primary/10 text-primary',
    neutral: 'border-border bg-card text-foreground/80',
    ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
    bad: 'border-destructive/30 bg-destructive/10 text-destructive',
    muted: 'border-border/50 bg-muted/40 text-muted-foreground',
  }[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border', toneCls, dim && 'opacity-60')}>
      <span className="uppercase tracking-wide opacity-70">{label}:</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}
