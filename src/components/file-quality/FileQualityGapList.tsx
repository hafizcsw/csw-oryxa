import { useTranslation } from 'react-i18next';
import { AlertCircle, Lightbulb } from 'lucide-react';
import type { FileQualityGap } from '@/features/file-quality/types';

interface FileQualityGapListProps {
  blockingGaps: FileQualityGap[];
  improvementGaps: FileQualityGap[];
}

export function FileQualityGapList({ blockingGaps, improvementGaps }: FileQualityGapListProps) {
  const { t } = useTranslation();

  if (blockingGaps.length === 0 && improvementGaps.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h3 className="font-semibold text-foreground">{t('file_quality.gap_list.title')}</h3>

      {blockingGaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" />
            {t('file_quality.gap_list.blocking')}
          </p>
          <ul className="space-y-1.5">
            {blockingGaps.map(g => (
              <li key={g.id} className="text-sm flex items-start gap-2 text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                <div>
                  <span>{t(g.title_key)}</span>
                  <span className="text-muted-foreground ms-1">— {t(g.action_key)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {improvementGaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4" />
            {t('file_quality.gap_list.improvements')}
          </p>
          <ul className="space-y-1.5">
            {improvementGaps.map(g => (
              <li key={g.id} className="text-sm flex items-start gap-2 text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                <div>
                  <span>{t(g.title_key)}</span>
                  <span className="ms-1">— {t(g.action_key)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
