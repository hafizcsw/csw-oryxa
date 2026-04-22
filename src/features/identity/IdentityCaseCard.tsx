import { useTranslation } from 'react-i18next';
import { useIdentityCase } from '@/hooks/useIdentityCase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, ShieldAlert, ShieldQuestion, AlertCircle } from 'lucide-react';

export function IdentityCaseCard() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useIdentityCase();
  const isAr = (i18n.language || 'en').startsWith('ar');

  const fmt = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(isAr ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return '—';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.ok) {
    return (
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldQuestion className="h-4 w-4 text-amber-500" />
            {t('identity.case.title', { defaultValue: 'Identity verification' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div>
              <p>{data?.error || 'load_failed'}</p>
              {data?.trace_id && (
                <p className="text-[10px] font-mono mt-1">trace: {data.trace_id}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ic = data.data;
  const status = ic?.status || 'none';
  const Icon = status === 'approved' ? ShieldCheck : status === 'rejected' ? ShieldAlert : ShieldQuestion;
  const variant: 'default' | 'destructive' | 'secondary' =
    status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {t('identity.case.title', { defaultValue: 'Identity verification' })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t('identity.case.status', { defaultValue: 'Status' })}
          </span>
          <Badge variant={variant} className="capitalize">{status}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t('identity.case.decidedAt', { defaultValue: 'Decided at' })}
          </span>
          <span className="text-sm text-foreground">{fmt(ic?.decided_at)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t('identity.case.updatedAt', { defaultValue: 'Last updated' })}
          </span>
          <span className="text-sm text-foreground">{fmt(ic?.updated_at)}</span>
        </div>
        {ic?.reviewer_note && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
              {t('identity.case.reviewerNote', { defaultValue: 'Reviewer note' })}
            </p>
            <p className="whitespace-pre-wrap">{ic.reviewer_note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
