/**
 * CommThreadView — Shared message thread view for the canonical communication backbone.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Paperclip, Loader2, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useCommMessages, commSendMessage, commMarkRead, type CommMessage } from '@/hooks/useCommApi';
import { useCommCall } from '@/contexts/CommCallContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CommThreadViewProps {
  threadId: string;
  threadType?: string;
  subject?: string;
  className?: string;
}

const ROLE_COLORS: Record<string, string> = {
  university_staff: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  teacher: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  csw_staff: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  system: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  student: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

export function CommThreadView({ threadId, threadType, subject, className }: CommThreadViewProps) {
  const { t } = useTranslation();
  const { messages, loading } = useCommMessages(threadId);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const msgsEndRef = useRef<HTMLDivElement>(null);
  const { startCall, call: activeCall } = useCommCall();

  // Derive remote participant from messages (first message not sent by me)
  const remoteParticipant = useMemo(() => {
    if (!userId) return null;
    const other = messages.find((m) => m.sender_id !== userId);
    if (!other) return null;
    return {
      userId: other.sender_id,
      name: other.sender_name || undefined,
      avatar: other.sender_avatar || undefined,
    };
  }, [messages, userId]);

  const canCall = !!remoteParticipant && !activeCall && threadType !== 'security_notice' && threadType !== 'system_notice';

  const handleStartCall = async (callType: 'audio' | 'video') => {
    if (!remoteParticipant) {
      toast({ title: t('comm.call.noRecipient'), variant: 'destructive' });
      return;
    }
    try {
      await startCall({
        threadId,
        calleeId: remoteParticipant.userId,
        callType,
        remoteName: remoteParticipant.name,
        remoteAvatar: remoteParticipant.avatar,
      });
    } catch (e: any) {
      toast({
        title: t('comm.call.failed'),
        description: e?.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  // Mark as read on open
  useEffect(() => {
    if (threadId) commMarkRead(threadId).catch(() => {});
  }, [threadId, messages.length]);

  // Auto-scroll
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      await commSendMessage({ thread_id: threadId, body: replyText.trim() });
      setReplyText('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isNotice = threadType === 'security_notice' || threadType === 'system_notice';

  // Group consecutive messages from same sender
  const groupedMessages = messages.reduce<Array<{ sender: CommMessage; msgs: CommMessage[] }>>((acc, msg) => {
    const last = acc[acc.length - 1];
    if (last && last.sender.sender_id === msg.sender_id) {
      last.msgs.push(msg);
    } else {
      acc.push({ sender: msg, msgs: [msg] });
    }
    return acc;
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className || ''}`}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {groupedMessages.map((group, gi) => {
          const isMine = group.sender.sender_id === userId;
          return (
            <div key={gi} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
              {!isMine && (
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={group.sender.sender_avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {(group.sender.sender_name || '?')[0]}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                {!isMine && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium text-foreground/80">
                      {group.sender.sender_name || t('comm.unknown')}
                    </span>
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-tight ${ROLE_COLORS[group.sender.sender_role] || ''}`}>
                      {t(`comm.role.${group.sender.sender_role}`)}
                    </Badge>
                  </div>
                )}
                {group.msgs.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    {msg.attachment_url && (
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs underline mt-1 opacity-80"
                      >
                        <Paperclip className="w-3 h-3" />
                        {msg.attachment_name || t('comm.attachment')}
                      </a>
                    )}
                    <span className={`text-[10px] block mt-0.5 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div ref={msgsEndRef} />
      </div>

      {/* Reply area — hidden for notice-type threads */}
      {!isNotice && (
        <div className="border-t border-border p-3 flex gap-2 items-end">
          <Textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('comm.typePlaceholder')}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!replyText.trim() || sending}
            className="rounded-full h-9 w-9 flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
