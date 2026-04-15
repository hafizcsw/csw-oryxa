import { useTranslation } from 'react-i18next';
import { CheckCircle2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileQualityGates } from '@/features/file-quality/types';

interface FileQualityGateProps {
  gates: FileQualityGates;
}

export function FileQualityGate({ gates }: FileQualityGateProps) {
  const { t } = useTranslation();

  const items = [
    { ok: gates.can_apply, label: t('file_quality.gates.apply') },
    { ok: gates.can_message_university, label: t('file_quality.gates.message_university') },
  ];

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('file_quality.gates.title')}</h4>
      <div className="flex flex-wrap gap-3">
        {items.map(item => (
          <div key={item.label} className={cn(
            'flex items-center gap-1.5 text-xs rounded-md px-2 py-1 border',
            item.ok
              ? 'border-green-500/20 bg-green-500/5 text-green-700 dark:text-green-400'
              : 'border-destructive/20 bg-destructive/5 text-destructive'
          )}>
            {item.ok ? <CheckCircle2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {item.label}
          </div>
        ))}
      </div>
      {!gates.can_apply && gates.apply_blocked_reasons.length > 0 && (
        <ul className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border">
          {gates.apply_blocked_reasons.map(r => (
            <li key={r} className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-destructive shrink-0" />
              {t(r)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
