import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSupportCase } from '@/hooks/useSupportCase';
import { useSupportMessages } from '@/hooks/useSupportMessages';
import { ReplyComposer } from './ReplyComposer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle, ShieldAlert, ShieldCheck, ShieldQuestion, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SupportThreadProps {
  caseId: string;
  /** When embedded (e.g. inside the FAB MiniChatWindow), hide the back nav and fill the parent. */
  embedded?: boolean;
}

export function SupportThread({ caseId, embedded = false }: SupportThreadProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isAr = (i18n.language || 'en').startsWith('ar');

  const caseQuery = useSupportCase(caseId);
  const { messagesQuery, sendMessage, sending, closeCase, closing } = useSupportMessages(caseId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = messagesQuery.data?.data?.messages ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(isAr ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return '';
    }
  };

  const supportCase = caseQuery.data?.data?.case;
  const identityLink = caseQuery.data?.data?.identity_link;
  const isClosed = supportCase?.status === 'closed';

  const handleClose = async () => {
    if (!confirm(t('support.confirmClose', { defaultValue: 'Close this case?' }))) return;
    await closeCase();
  };

  const identityVariant =
    identityLink?.status === 'approved'
      ? 'default'
      : identityLink?.status === 'rejected'
        ? 'destructive'
        : 'secondary';
  const IdentityIcon =
    identityLink?.status === 'approved'
      ? ShieldCheck
      : identityLink?.status === 'rejected'
        ? ShieldAlert
        : ShieldQuestion;

  return (
    <div
      className={cn(
        'flex flex-col bg-background overflow-hidden',
        embedded
          ? 'h-full min-h-0'
          : 'h-[calc(100vh-8rem)] max-h-[800px] rounded-xl border border-border',
      )}
    >
      <div className={cn('border-b border-border px-4 py-3 flex items-center gap-3', embedded && 'px-3 py-2')}>
        {!embedded && (
          <Button variant="ghost" size="icon" onClick={() => navigate('/portal/support')} aria-label={t('common.back', { defaultValue: 'Back' })}>
            <ArrowLeft className={cn('h-4 w-4', isAr && 'rotate-180')} />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          {caseQuery.isLoading ? (
            <Skeleton className="h-5 w-48" />
          ) : (
            <p className="text-sm font-semibold text-foreground truncate">
              {supportCase?.subject || t('support.untitled', { defaultValue: 'Support case' })}
            </p>
          )}
        </div>
        {supportCase?.status && (
          <Badge variant={isClosed ? 'secondary' : 'default'} className="capitalize">
            {supportCase.status}
          </Badge>
        )}
        {!isClosed && supportCase && (
          <Button variant="outline" size="sm" onClick={handleClose} disabled={closing}>
            <X className="h-3.5 w-3.5 me-1" />
            {t('support.close', { defaultValue: 'Close' })}
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/20">
        {identityLink && (
          <div className="rounded-lg border border-border bg-card px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {t('support.thread.identityLink.title', { defaultValue: 'Linked identity review' })}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {typeof identityLink.attempt_no === 'number' && (
                    <span>{t('support.thread.identityLink.attempt', { defaultValue: 'Attempt' })} #{identityLink.attempt_no}</span>
                  )}
                  {identityLink.reviewed_at && <span>{fmtTime(identityLink.reviewed_at)}</span>}
                </div>
              </div>
              <Badge variant={identityVariant} className="capitalize flex items-center gap-1">
                <IdentityIcon className="h-3 w-3" />
                {identityLink.status || t('support.thread.identityLink.unknown', { defaultValue: 'Unknown' })}
              </Badge>
            </div>
            {identityLink.student_visible_note && (
              <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                {identityLink.student_visible_note}
              </p>
            )}
          </div>
        )}

        {messagesQuery.isLoading ? (
          <>
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-16 w-2/3 ms-auto" />
            <Skeleton className="h-16 w-1/2" />
          </>
        ) : messagesQuery.data && !messagesQuery.data.ok ? (
          <div className="flex items-start gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div>
              <p>{messagesQuery.data.error || 'load_failed'}</p>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                trace: {messagesQuery.data.trace_id}
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t('support.thread.empty', { defaultValue: 'No messages yet.' })}
          </p>
        ) : (
          messages.map((m) => {
            const own = m.sender_type === 'customer';
            const system = m.sender_type === 'system' || m.message_kind === 'system';
            const authorLabel = own
              ? t('support.thread.author.customer', { defaultValue: 'You' })
              : m.sender_type === 'staff'
                ? (m.author_display || t('support.thread.author.staff', { defaultValue: 'Support staff' }))
                : t('support.thread.author.system', { defaultValue: 'System' });

            if (system) {
              return (
                <div key={m.id} className="flex justify-center">
                  <div className="max-w-[85%] rounded-lg border border-border bg-card px-3 py-2 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">{authorLabel}</p>
                    <p className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">{m.body}</p>
                    <p className="text-[10px] mt-1 text-muted-foreground">{fmtTime(m.created_at)}</p>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className={cn('flex', own ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                    own
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card border border-border text-foreground rounded-bl-sm',
                  )}
                >
                  <p className={cn('text-[11px] font-medium mb-1', own ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {authorLabel}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={cn(
                      'text-[10px] mt-1',
                      own ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    {fmtTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ReplyComposer onSend={(body) => sendMessage(body)} disabled={isClosed} sending={sending} />
    </div>
  );
}
