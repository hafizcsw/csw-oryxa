// ═══════════════════════════════════════════════════════════════
// AssemblyFieldRow — single field row in a lane
// ═══════════════════════════════════════════════════════════════
// Animation: container fade → label → typewriter value → status badge.
// Status is ALWAYS derived from live proposal/promoted state — never
// from template membership.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Check, AlertCircle, Clock, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTypewriter } from '@/hooks/useTypewriter';
import { fieldLabelKey } from '@/features/documents/assembly-field-templates';

export type FieldStatus = 'accepted' | 'pending' | 'unresolved' | 'empty';

interface AssemblyFieldRowProps {
  fieldKey: string;
  value: string | null;
  status: FieldStatus;
  reasonKey?: string | null;
  delay?: number; // ms before reveal
  animate?: boolean;
}

export function AssemblyFieldRow({
  fieldKey,
  value,
  status,
  reasonKey,
  delay = 0,
  animate = true,
}: AssemblyFieldRowProps) {
  const { t } = useLanguage();
  const [revealed, setRevealed] = useState(!animate);

  useEffect(() => {
    if (!animate) { setRevealed(true); return; }
    const id = window.setTimeout(() => setRevealed(true), delay);
    return () => window.clearTimeout(id);
  }, [animate, delay]);

  const showValue = status === 'accepted' || status === 'pending';
  const { displayedText, isComplete } = useTypewriter({
    text: showValue && value ? String(value) : '',
    cps: 60,
    enabled: animate && revealed && showValue,
  });

  const label = t(fieldLabelKey(fieldKey)) || fieldKey.split('.').pop();
  const finalText = animate ? displayedText : (showValue && value ? String(value) : '');

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 py-2 px-3 rounded-md border transition-all duration-300',
        revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
        status === 'accepted' && 'border-emerald-500/30 bg-emerald-500/5',
        status === 'pending' && 'border-amber-500/30 bg-amber-500/5',
        status === 'unresolved' && 'border-destructive/30 bg-destructive/5',
        status === 'empty' && 'border-border/40 bg-muted/20',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">
          {label}
        </div>
        <div className="text-sm font-mono text-foreground break-words min-h-[1.25rem]">
          {showValue ? (
            <>
              {finalText}
              {animate && !isComplete && showValue && <span className="opacity-60">▍</span>}
            </>
          ) : status === 'unresolved' ? (
            <span className="text-destructive/80 text-xs not-italic">
              {reasonKey ? t(reasonKey) : t('portal.assembly.status.unresolved')}
            </span>
          ) : (
            <span className="text-muted-foreground/70 text-xs">—</span>
          )}
        </div>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function StatusBadge({ status }: { status: FieldStatus }) {
  const { t } = useLanguage();
  const cfg = {
    accepted: { Icon: Lock, cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', label: 'portal.assembly.status.accepted' },
    pending: { Icon: Clock, cls: 'text-amber-600 bg-amber-500/10 border-amber-500/20', label: 'portal.assembly.status.pending' },
    unresolved: { Icon: AlertCircle, cls: 'text-destructive bg-destructive/10 border-destructive/20', label: 'portal.assembly.status.unresolved' },
    empty: { Icon: Check, cls: 'text-muted-foreground bg-muted/30 border-border', label: 'portal.assembly.status.empty' },
  }[status];
  const { Icon, cls, label } = cfg;
  return (
    <span className={cn('shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border', cls)}>
      <Icon className="w-3 h-3" />
      {t(label)}
    </span>
  );
}
