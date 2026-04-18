// ═══════════════════════════════════════════════════════════════
// AssemblyFieldRow — single field row in a lane
// ═══════════════════════════════════════════════════════════════
// Animation: container fade → label → typewriter value → status badge.
// Status is ALWAYS derived from live proposal/promoted state — never
// from template membership.
//
// INLINE EDIT (per UX decision):
//   - Click pencil → field becomes editable input.
//   - On save → onSave(newValue) is called by parent which:
//       * persists the value
//       * resets the proposal to `pending_review` for staff review.
//   - Editing an `accepted` field shows a one-time warning dialog
//     explaining the field will be reset to pending review.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { Check, AlertCircle, Clock, Lock, Pencil, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTypewriter } from '@/hooks/useTypewriter';
import { fieldLabelKey } from '@/features/documents/assembly-field-templates';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type FieldStatus = 'accepted' | 'pending' | 'unresolved' | 'empty';

interface AssemblyFieldRowProps {
  fieldKey: string;
  value: string | null;
  status: FieldStatus;
  reasonKey?: string | null;
  delay?: number; // ms before reveal
  animate?: boolean;
  /** When provided, the row supports inline editing. */
  onSave?: (newValue: string) => void | Promise<void>;
}

export function AssemblyFieldRow({
  fieldKey,
  value,
  status,
  reasonKey,
  delay = 0,
  animate = true,
  onSave,
}: AssemblyFieldRowProps) {
  const { t } = useLanguage();
  const [revealed, setRevealed] = useState(!animate);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!animate) { setRevealed(true); return; }
    const id = window.setTimeout(() => setRevealed(true), delay);
    return () => window.clearTimeout(id);
  }, [animate, delay]);

  useEffect(() => {
    if (editing) {
      // focus shortly after render
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [editing]);

  const showValue = status === 'accepted' || status === 'pending';
  const { displayedText, isComplete } = useTypewriter({
    text: showValue && value ? String(value) : '',
    cps: 60,
    enabled: animate && revealed && showValue && !editing,
  });

  const label = t(fieldLabelKey(fieldKey)) || fieldKey.split('.').pop();
  const finalText = animate ? displayedText : (showValue && value ? String(value) : '');
  const canEdit = !!onSave;

  const beginEdit = () => {
    if (!canEdit) return;
    if (status === 'accepted') {
      setPendingConfirm(true);
      return;
    }
    setDraft(value ? String(value) : '');
    setEditing(true);
  };

  const confirmEditAccepted = () => {
    setPendingConfirm(false);
    setDraft(value ? String(value) : '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };

  const commitEdit = async () => {
    if (!onSave) return;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === (value ?? '')) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
      setDraft('');
    } finally {
      setSaving(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  return (
    <>
      <div
        className={cn(
          'group flex items-start justify-between gap-3 py-2 px-3 rounded-md border transition-all duration-300',
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
            {editing ? (
              <div className="flex items-center gap-1.5">
                <Input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={saving}
                  className="h-7 text-sm font-mono px-2 py-1"
                  placeholder={t('portal.assembly.edit.placeholder')}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-emerald-600 hover:text-emerald-600 hover:bg-emerald-500/10"
                  onClick={() => void commitEdit()}
                  disabled={saving}
                  aria-label={t('portal.assembly.edit.save')}
                  title={t('portal.assembly.edit.save')}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={cancelEdit}
                  disabled={saving}
                  aria-label={t('portal.assembly.edit.cancel')}
                  title={t('portal.assembly.edit.cancel')}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : showValue ? (
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
          {editing && (
            <p className="text-[10px] text-amber-600 mt-1">
              {t('portal.assembly.edit.pending_notice')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!editing && canEdit && status !== 'unresolved' && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground transition-opacity"
              onClick={beginEdit}
              aria-label={t('portal.assembly.edit.edit')}
              title={t('portal.assembly.edit.edit')}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {!editing && canEdit && status === 'unresolved' && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/10"
              onClick={beginEdit}
            >
              <Pencil className="h-3 w-3 me-1" />
              {t('portal.assembly.edit.add_manually')}
            </Button>
          )}
          {!editing && <StatusBadge status={status} />}
        </div>
      </div>

      <AlertDialog open={pendingConfirm} onOpenChange={setPendingConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('portal.assembly.edit.confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('portal.assembly.edit.confirm_body')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('portal.assembly.edit.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEditAccepted}>
              {t('portal.assembly.edit.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
