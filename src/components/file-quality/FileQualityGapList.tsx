import { useTranslation } from 'react-i18next';
import { AlertCircle, Lightbulb } from 'lucide-react';
import type { FileQualityGap } from '@/features/file-quality/types';

interface FileQualityGapListProps {
  blockingGaps: FileQualityGap[];
  improvementGaps: FileQualityGap[];
}

export function FileQualityGapList({ blockingGaps, improvementGaps }: FileQualityGapListProps) {
  const { t } = useTranslation();

  if (blockingGaps.length === 0 && improvementGaps.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-3">
      {blockingGaps.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {t('file_quality.gap_list.blocking')}
          </p>
          <ul className="space-y-0.5">
            {blockingGaps.map(g => (
              <li key={g.id} className="text-xs flex items-start gap-1.5 text-foreground">
                <span className="w-1 h-1 rounded-full bg-destructive mt-1.5 shrink-0" />
                <span>{t(g.title_key)} <span className="text-muted-foreground">— {t(g.action_key)}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {improvementGaps.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            {t('file_quality.gap_list.improvements')}
          </p>
          <ul className="space-y-0.5">
            {improvementGaps.map(g => (
              <li key={g.id} className="text-xs flex items-start gap-1.5 text-muted-foreground">
                <span className="w-1 h-1 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                <span>{t(g.title_key)} — {t(g.action_key)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
