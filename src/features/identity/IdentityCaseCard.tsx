import { useTranslation } from 'react-i18next';
import { useIdentityCase } from '@/hooks/useIdentityCase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, ShieldAlert, ShieldQuestion, AlertCircle } from 'lucide-react';
import type { IdentityAttempt } from '@/lib/crmBridge';

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

  const current: IdentityAttempt | null = data.data?.case?.current_attempt ?? null;
  const previous: IdentityAttempt[] = data.data?.case?.previous_attempts ?? [];
  const status = current?.status || 'none';
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
        {!current ? (
          <p className="text-sm text-muted-foreground">
            {t('identity.case.none', { defaultValue: 'No identity verification attempt yet.' })}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('identity.case.status', { defaultValue: 'Status' })}
              </span>
              <Badge variant={variant} className="capitalize">{status}</Badge>
            </div>
            {typeof current.attempt_number === 'number' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('identity.case.attempt', { defaultValue: 'Attempt' })}
                </span>
                <span className="text-sm text-foreground">#{current.attempt_number}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('identity.case.submittedAt', { defaultValue: 'Submitted at' })}
              </span>
              <span className="text-sm text-foreground">{fmt(current.submitted_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('identity.case.reviewedAt', { defaultValue: 'Reviewed at' })}
              </span>
              <span className="text-sm text-foreground">{fmt(current.reviewed_at)}</span>
            </div>
            {current.student_visible_note && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">
                <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                  {t('identity.case.reviewerNote', { defaultValue: 'Reviewer note' })}
                </p>
                <p className="whitespace-pre-wrap">{current.student_visible_note}</p>
              </div>
            )}
          </>
        )}

        {previous.length > 0 && (
          <div className="pt-3 border-t border-border">
            <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              {t('identity.case.previousAttempts', { defaultValue: 'Previous attempts' })}
            </p>
            <ul className="space-y-2">
              {previous.map((p, idx) => (
                <li
                  key={`${p.attempt_number ?? idx}-${p.reviewed_at ?? p.submitted_at ?? idx}`}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="text-foreground capitalize">
                      {p.status}
                      {typeof p.attempt_number === 'number' && (
                        <span className="text-muted-foreground"> · #{p.attempt_number}</span>
                      )}
                    </p>
                    {p.student_visible_note && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">
                        {p.student_visible_note}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                    {fmt(p.reviewed_at || p.submitted_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
