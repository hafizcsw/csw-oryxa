import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle2, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocumentChecklistItem } from '@/features/readiness/types';

interface DocumentChecklistProps {
  items: DocumentChecklistItem[];
  onUpload?: (docType: string) => void;
}

const STATUS_CONFIG: Record<'uploaded' | 'missing', { icon: typeof CheckCircle2; color: string; bgColor: string }> = {
  uploaded: { icon: CheckCircle2, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  missing: { icon: Ban, color: 'text-red-500', bgColor: 'bg-red-500/10' },
};

export function DocumentChecklist({ items, onUpload }: DocumentChecklistProps) {
  const { t } = useLanguage();
  const uploaded = items.filter(i => i.status === 'uploaded').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{t('readiness.documents.title')}</h3>
        <span className="text-sm text-muted-foreground">
          {uploaded} / {items.length} {t('readiness.documents.completed')}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${items.length > 0 ? (uploaded / items.length) * 100 : 0}%` }}
        />
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map(item => {
          const normalizedStatus: 'uploaded' | 'missing' = item.status === 'uploaded' ? 'uploaded' : 'missing';
          const config = STATUS_CONFIG[normalizedStatus];
          const Icon = config.icon;
          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border border-border transition-colors',
                item.status === 'missing' && 'cursor-pointer hover:border-primary/50',
                config.bgColor
              )}
              onClick={() => item.status === 'missing' && onUpload?.(item.doc_type)}
              role={item.status === 'missing' ? 'button' : undefined}
            >
              <Icon className={cn('h-5 w-5 shrink-0', config.color)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t(item.label_key)}</p>
                <p className="text-xs text-muted-foreground">{t(`readiness.documents.status.${normalizedStatus}`)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
