import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSupportCase } from '@/hooks/useSupportCase';
import { useSupportMessages } from '@/hooks/useSupportMessages';
import { ReplyComposer } from './ReplyComposer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SupportThreadProps {
  caseId: string;
}

export function SupportThread({ caseId }: SupportThreadProps) {
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

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[800px] rounded-xl border border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/portal/support')} aria-label="Back">
          <ArrowLeft className={cn('h-4 w-4', isAr && 'rotate-180')} />
        </Button>
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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/20">
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

      {/* Composer */}
      <ReplyComposer onSend={(body) => sendMessage(body)} disabled={isClosed} sending={sending} />
    </div>
  );
}
