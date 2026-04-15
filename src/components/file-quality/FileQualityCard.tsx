import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle, XCircle, Clock, TrendingUp } from 'lucide-react';
import type { FileQualityResult, FileQualityVerdict, DimensionScore } from '@/features/file-quality/types';
import { cn } from '@/lib/utils';

const VERDICT_CONFIG: Record<FileQualityVerdict, { icon: typeof TrendingUp; colorClass: string; bgClass: string; key: string }> = {
  apply_ready: { icon: CheckCircle2, colorClass: 'text-green-600', bgClass: 'bg-green-500/10', key: 'file_quality.verdicts.apply_ready' },
  near_ready: { icon: Clock, colorClass: 'text-yellow-600', bgClass: 'bg-yellow-500/10', key: 'file_quality.verdicts.near_ready' },
  needs_work: { icon: AlertTriangle, colorClass: 'text-orange-500', bgClass: 'bg-orange-500/10', key: 'file_quality.verdicts.needs_work' },
  incomplete: { icon: XCircle, colorClass: 'text-destructive', bgClass: 'bg-destructive/10', key: 'file_quality.verdicts.incomplete' },
};

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? 'hsl(var(--chart-2))' : score >= 50 ? 'hsl(45 93% 47%)' : 'hsl(var(--destructive))';

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        className="rotate-90 origin-center fill-foreground text-sm font-bold"
        style={{ fontSize: 14 }}>
        {score}%
      </text>
    </svg>
  );
}

function DimensionBar({ dim, t }: { dim: DimensionScore; t: (k: string) => string }) {
  const pct = dim.total > 0 ? (dim.filled / dim.total) * 100 : 0;
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-destructive';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{t(dim.label_key)}</span>
      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
        <div className={cn('h-full rounded-full transition-all duration-500', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-foreground w-7 text-end shrink-0">{dim.filled}/{dim.total}</span>
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

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex gap-4 items-start">
      {/* Score ring */}
      <div className="flex flex-col items-center gap-1">
        <ScoreRing score={result.overall_score} />
        <div className={cn('flex items-center gap-1 text-xs font-medium', config.colorClass)}>
          <Icon className="h-3 w-3" />
          <span>{t(config.key)}</span>
        </div>
      </div>

      {/* Dimensions */}
      <div className="flex-1 min-w-0 space-y-1.5 pt-1">
        {dimensions.map(dim => (
          <DimensionBar key={dim.label_key} dim={dim} t={t} />
        ))}
      </div>
    </div>
  );
}
