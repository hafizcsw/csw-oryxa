import { useTranslation } from 'react-i18next';
import { CheckCircle2, Lock, MessageSquare } from 'lucide-react';
import type { FileQualityGates } from '@/features/file-quality/types';

interface FileQualityGateProps {
  gates: FileQualityGates;
}

export function FileQualityGate({ gates }: FileQualityGateProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
      <h3 className="font-semibold text-foreground">{t('file_quality.gates.title')}</h3>

      <div className="space-y-2">
        {/* Apply gate */}
        <div className="flex items-center gap-3 text-sm">
          {gates.can_apply ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <Lock className="h-4 w-4 text-destructive shrink-0" />
          )}
          <span className={gates.can_apply ? 'text-foreground' : 'text-muted-foreground'}>
            {t('file_quality.gates.apply')}
          </span>
        </div>

        {/* Message gate */}
        <div className="flex items-center gap-3 text-sm">
          {gates.can_message_university ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className={gates.can_message_university ? 'text-foreground' : 'text-muted-foreground'}>
            {t('file_quality.gates.message_university')}
          </span>
        </div>
      </div>

      {/* Blocked reasons */}
      {!gates.can_apply && gates.apply_blocked_reasons.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">{t('file_quality.gates.blocked_because')}</p>
          <ul className="space-y-1">
            {gates.apply_blocked_reasons.map(reason => (
              <li key={reason} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
                {t(reason)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
