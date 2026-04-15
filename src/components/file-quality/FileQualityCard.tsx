import { useTranslation } from 'react-i18next';
import { Shield, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { FileQualityResult, FileQualityVerdict, DimensionScore } from '@/features/file-quality/types';

const VERDICT_CONFIG: Record<FileQualityVerdict, { icon: typeof Shield; colorClass: string; key: string }> = {
  apply_ready: { icon: CheckCircle2, colorClass: 'text-green-600', key: 'file_quality.verdicts.apply_ready' },
  near_ready: { icon: Clock, colorClass: 'text-yellow-600', key: 'file_quality.verdicts.near_ready' },
  needs_work: { icon: AlertTriangle, colorClass: 'text-orange-500', key: 'file_quality.verdicts.needs_work' },
  incomplete: { icon: XCircle, colorClass: 'text-destructive', key: 'file_quality.verdicts.incomplete' },
};

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
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      {/* Verdict header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-muted ${config.colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${config.colorClass}`}>{t(config.key)}</p>
          <p className="text-sm text-muted-foreground">
            {t('file_quality.overall_score', { score: result.overall_score })}
          </p>
        </div>
        <span className="text-2xl font-bold text-foreground">{result.overall_score}%</span>
      </div>

      {/* Dimension bars */}
      <div className="space-y-3">
        {dimensions.map(dim => (
          <div key={dim.label_key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t(dim.label_key)}</span>
              <span className="font-medium text-foreground">{dim.filled}/{dim.total}</span>
            </div>
            <Progress value={dim.score} className="h-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
