import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSupportCases } from '@/hooks/useSupportCases';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LifeBuoy, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SupportInbox() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, error } = useSupportCases();

  const isAr = (i18n.language || 'en').startsWith('ar');
  const fmt = (iso?: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(isAr ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('support.error.loadCases', { defaultValue: 'Could not load support cases' })}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data?.error || (error as Error | undefined)?.message || 'unknown_error'}
            </p>
            {data?.trace_id && (
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">trace: {data.trace_id}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const cases = data.data?.cases ?? [];

  if (cases.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <LifeBuoy className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {t('support.empty.title', { defaultValue: 'No support cases yet' })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('support.empty.subtitle', { defaultValue: 'When you contact your counselor, conversations appear here.' })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {cases.map((c) => {
        const unread = (c.unread_for_customer ?? 0) > 0;
        return (
          <button
            key={c.case_id}
            type="button"
            onClick={() => navigate(`/portal/support/${c.case_id}`)}
            className={cn(
              'w-full text-start rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors p-4',
              unread && 'ring-1 ring-primary/20',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {c.subject || t('support.untitled', { defaultValue: 'Support case' })}
                  </p>
                  {unread && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                </div>
                {c.last_message_preview && (
                  <p className="text-xs text-muted-foreground truncate mt-1">{c.last_message_preview}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">{fmt(c.last_message_at || c.updated_at)}</p>
              </div>
              <Badge variant={c.status === 'closed' ? 'secondary' : 'default'} className="capitalize flex-shrink-0">
                {c.status || 'open'}
              </Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}
