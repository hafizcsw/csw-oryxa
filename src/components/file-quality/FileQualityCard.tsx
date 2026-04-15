import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, XCircle, Clock, TrendingUp, Lock, AlertCircle, Lightbulb } from 'lucide-react';
import type { FileQualityResult, FileQualityVerdict, DimensionScore, FileQualityGates, FileQualityGap } from '@/features/file-quality/types';
import { cn } from '@/lib/utils';

const VERDICT_CONFIG: Record<FileQualityVerdict, { icon: typeof TrendingUp; colorClass: string; key: string }> = {
  apply_ready: { icon: CheckCircle2, colorClass: 'text-green-600', key: 'file_quality.verdicts.apply_ready' },
  near_ready: { icon: Clock, colorClass: 'text-yellow-600', key: 'file_quality.verdicts.near_ready' },
  needs_work: { icon: AlertTriangle, colorClass: 'text-orange-500', key: 'file_quality.verdicts.needs_work' },
  incomplete: { icon: XCircle, colorClass: 'text-destructive', key: 'file_quality.verdicts.incomplete' },
};

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? 'hsl(var(--chart-2))' : score >= 50 ? 'hsl(45 93% 47%)' : 'hsl(var(--destructive))';

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={3.5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3.5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        className="rotate-90 origin-center fill-foreground font-bold"
        style={{ fontSize: 11 }}>
        {score}%
      </text>
    </svg>
  );
}

function DimensionBar({ dim, t }: { dim: DimensionScore; t: (k: string) => string }) {
  const pct = dim.total > 0 ? (dim.filled / dim.total) * 100 : 0;
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-destructive';

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground truncate flex-1 min-w-0">{t(dim.label_key)}</span>
      <div className="w-14 h-1 rounded-full bg-muted overflow-hidden shrink-0">
        <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-5 text-end shrink-0">{dim.filled}/{dim.total}</span>
    </div>
  );
}

interface FileQualityCardProps {
  result: FileQualityResult;
}

export function FileQualityCard({ result }: FileQualityCardProps) {
  const { t } = useTranslation();
  const config = VERDICT_CONFIG[result.verdict];
  const Icon = config.icon;

  const dimensions: DimensionScore[] = [
    result.profile_completeness,
    result.document_completeness,
    result.academic_eligibility,
    result.communication_readiness,
    result.competitive_strength,
  ];

  const gateItems = [
    { ok: result.gates.can_apply, label: t('file_quality.gates.apply') },
    { ok: result.gates.can_message_university, label: t('file_quality.gates.message_university') },
  ];

  const hasGaps = result.blocking_gaps.length > 0 || result.improvement_gaps.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      {/* Row 1: Score + Dimensions + Gates */}
      <div className="flex gap-3 items-start">
        {/* Score */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <ScoreRing score={result.overall_score} />
          <div className={cn('flex items-center gap-0.5 text-[10px] font-medium', config.colorClass)}>
            <Icon className="h-2.5 w-2.5" />
            <span>{t(config.key)}</span>
          </div>
        </div>

        {/* Dimensions */}
        <div className="flex-1 min-w-0 space-y-1 pt-0.5">
          {dimensions.map(dim => (
            <DimensionBar key={dim.label_key} dim={dim} t={t} />
          ))}
        </div>

        {/* Gates - vertical pills */}
        <div className="flex flex-col gap-1 shrink-0">
          {gateItems.map(item => (
            <div key={item.label} className={cn(
              'flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 border whitespace-nowrap',
              item.ok
                ? 'border-green-500/20 bg-green-500/5 text-green-700 dark:text-green-400'
                : 'border-destructive/20 bg-destructive/5 text-destructive'
            )}>
              {item.ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: Gaps (inline) */}
      {hasGaps && (
        <div className="border-t border-border pt-2 flex flex-wrap gap-x-4 gap-y-1">
          {result.blocking_gaps.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-destructive flex items-center gap-0.5">
                <AlertCircle className="h-2.5 w-2.5" />
                {t('file_quality.gap_list.blocking')}
              </p>
              {result.blocking_gaps.map(g => (
                <p key={g.id} className="text-[10px] text-muted-foreground ps-3">
                  {t(g.title_key)} — <span className="text-foreground/70">{t(g.action_key)}</span>
                </p>
              ))}
            </div>
          )}
          {result.improvement_gaps.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-0.5">
                <Lightbulb className="h-2.5 w-2.5" />
                {t('file_quality.gap_list.improvements')}
              </p>
              {result.improvement_gaps.map(g => (
                <p key={g.id} className="text-[10px] text-muted-foreground ps-3">
                  {t(g.title_key)} — {t(g.action_key)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blocked reasons */}
      {!result.gates.can_apply && result.gates.apply_blocked_reasons.length > 0 && (
        <div className="border-t border-border pt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {result.gates.apply_blocked_reasons.map(r => (
            <span key={r} className="text-[10px] text-destructive/80 flex items-center gap-0.5">
              <span className="w-1 h-1 rounded-full bg-destructive shrink-0" />
              {t(r)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
