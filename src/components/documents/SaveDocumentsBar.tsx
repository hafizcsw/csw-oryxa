// ═══════════════════════════════════════════════════════════════
// SaveDocumentsBar
// ───────────────────────────────────────────────────────────────
// Sticky footer bar shown when there are unsaved uploaded documents.
// User must tick the consent checkbox and click "Save" to confirm —
// otherwise documents are auto-deleted on next page load.
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ShieldAlert, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SaveDocumentsBarProps {
  pendingCount: number;
  onSave: () => Promise<void> | void;
  className?: string;
}

export function SaveDocumentsBar({ pendingCount, onSave, className }: SaveDocumentsBarProps) {
  const { t } = useTranslation('common');
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  if (pendingCount === 0) return null;

  const handleClick = async () => {
    if (!agreed || saving) return;
    setSaving(true);
    try {
      await onSave();
      setAgreed(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        'sticky bottom-0 z-30 -mx-4 mt-6 border-t border-amber-300/60 bg-amber-50/95 px-4 py-3 backdrop-blur',
        'dark:border-amber-700/60 dark:bg-amber-950/80',
        'sm:mx-0 sm:rounded-lg sm:border',
        className,
      )}
      role="region"
      aria-label={t('portal.saveDocs.region_label', 'Unsaved documents')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              {t('portal.saveDocs.title', { count: pendingCount, defaultValue: '{{count}} unsaved document(s)' })}
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
              {t(
                'portal.saveDocs.warning',
                'If you leave or refresh without saving, these files will be deleted automatically.',
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Checkbox
              id="save-docs-consent"
              checked={agreed}
              onCheckedChange={v => setAgreed(v === true)}
              disabled={saving}
            />
            <Label htmlFor="save-docs-consent" className="cursor-pointer text-xs text-amber-900 dark:text-amber-100">
              {t('portal.saveDocs.consent', 'I agree to the terms')}
            </Label>
          </div>
          <Button
            onClick={handleClick}
            disabled={!agreed || saving}
            size="sm"
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('portal.saveDocs.save_button', 'Save documents')}
          </Button>
        </div>
      </div>
    </div>
  );
}
