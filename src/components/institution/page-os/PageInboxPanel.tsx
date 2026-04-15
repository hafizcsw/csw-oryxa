/**
 * University page inbox panel — staff-only overlay.
 * Lists threads, allows replying as university.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox, Send, ChevronLeft, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PageInboxPanelProps {
  universityId: string;
}

interface Thread {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  university_inbox_messages: Array<{
    id: string;
    body: string;
    sender_id: string;
    is_university_reply: boolean;
    created_at: string;
  }>;
}

export function PageInboxPanel({ universityId }: PageInboxPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'inbox.threads', university_id: universityId } });
      if (data?.ok) setThreads(data.threads || []);
    } finally {
      setLoading(false);
    }
  }, [universityId]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const sendReply = async () => {
    if (!selectedThread || !replyText.trim()) return;
    setSending(true);
    try {
      const { data } = await supabase.functions.invoke('university-page-manage', { body: { action: 'inbox.reply', university_id: universityId, thread_id: selectedThread.id, message: replyText.trim() } });
      if (data?.ok) {
        setReplyText('');
        fetchThreads();
        toast({ title: t('pageOS.inbox.sent') });
      }
    } finally {
      setSending(false);
    }
  };

  const statusColor: Record<string, string> = {
    open: 'bg-green-100 text-green-800',
    assigned: 'bg-blue-100 text-blue-800',
    closed: 'bg-gray-100 text-gray-800',
  };

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{t('pageOS.common.loading')}</div>;
  }

  if (selectedThread) {
    const msgs = selectedThread.university_inbox_messages || [];
    return (
      <div className="fb-inbox-thread">
        <div className="fb-inbox-thread__header">
          <Button variant="ghost" size="sm" onClick={() => setSelectedThread(null)}>
            <ChevronLeft className="w-4 h-4 me-1" /> {t('pageOS.inbox.back')}
          </Button>
          <span className="text-sm font-medium">{selectedThread.subject || t('pageOS.inbox.noSubject')}</span>
        </div>

        <div className="fb-inbox-thread__messages">
          {msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(msg => (
            <div key={msg.id} className={`fb-inbox-msg ${msg.is_university_reply ? 'fb-inbox-msg--university' : 'fb-inbox-msg--visitor'}`}>
              <div className="fb-inbox-msg__bubble">
                <p className="text-sm">{msg.body}</p>
                <span className="fb-inbox-msg__time">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="fb-inbox-thread__reply">
          <Textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder={t('pageOS.inbox.replyPlaceholder')}
            className="min-h-[60px]"
          />
          <Button size="sm" onClick={sendReply} disabled={!replyText.trim() || sending} className="mt-2 gap-1">
            <Send className="w-3 h-3" /> {t('pageOS.inbox.send')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fb-inbox">
      <div className="fb-inbox__header">
        <h3 className="fb-inbox__title">
          <Inbox className="w-4 h-4" /> {t('pageOS.inbox.title')}
        </h3>
      </div>

      {threads.length === 0 ? (
        <div className="fb-inbox__empty">
          <Inbox className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mt-2">{t('pageOS.inbox.empty')}</p>
        </div>
      ) : (
        <div className="fb-inbox__list">
          {threads.map(thread => (
            <button key={thread.id} className="fb-inbox__thread" onClick={() => setSelectedThread(thread)}>
              <div className="fb-inbox__thread-info">
                <span className="fb-inbox__thread-subject">{thread.subject || t('pageOS.inbox.noSubject')}</span>
                <span className="fb-inbox__thread-date">{new Date(thread.updated_at).toLocaleDateString()}</span>
              </div>
              <div className="fb-inbox__thread-meta">
                <Badge className={`text-xs ${statusColor[thread.status] || ''}`}>
                  {t(`pageOS.inbox.status.${thread.status}`)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {thread.university_inbox_messages?.length || 0} {t('pageOS.inbox.messages')}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
