import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, UserCheck, UserX, MessageCircle, Users, Send, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DSButton } from '@/components/design-system/DSButton';
import { buildAvatarDisplayUrl } from '@/features/avatar/avatarImageUtils';
import { useStudentFriendships, type Friendship } from '@/hooks/useStudentFriendships';
import { commCreateThread, commSendMessage, useCommMessages, type CommMessage } from '@/hooks/useCommApi';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface DashboardCommunityTabProps {
  userId: string | null | undefined;
  courseKey?: string;
}

export function DashboardCommunityTab({ userId, courseKey = 'russian' }: DashboardCommunityTabProps) {
  const { t } = useLanguage();
  const {
    friends, pendingReceived, pendingSent, suggestions,
    loading, sendRequest, acceptRequest, rejectRequest, removeFriend,
  } = useStudentFriendships(userId, courseKey);

  const [activeChatFriendship, setActiveChatFriendship] = useState<Friendship | null>(null);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Active chat */}
      <AnimatePresence>
        {activeChatFriendship && userId && (
          <PeerChatPanel
            friendship={activeChatFriendship}
            userId={userId}
            onClose={() => setActiveChatFriendship(null)}
          />
        )}
      </AnimatePresence>

      {/* Pending received requests */}
      {pendingReceived.length > 0 && (
        <Section title={t('languages.dashboard.community.friendRequests')} icon={<UserPlus className="w-5 h-5 text-primary" />}>
          <div className="space-y-2">
            {pendingReceived.map(f => (
              <FriendRequestCard
                key={f.id}
                name={f.requester_name}
                avatar={f.requester_avatar}
                onAccept={() => acceptRequest(f.id)}
                onReject={() => rejectRequest(f.id)}
                t={t}
              />
            ))}
          </div>
        </Section>
      )}

      {/* My friends */}
      <Section title={t('languages.dashboard.community.myFriends')} icon={<Users className="w-5 h-5 text-emerald-500" />} count={friends.length}>
        {friends.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('languages.dashboard.community.noFriendsYet')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {friends.map(f => {
              const isRequester = f.requester_id === userId;
              const friendName = isRequester ? f.recipient_name : f.requester_name;
              const friendAvatar = isRequester ? f.recipient_avatar : f.requester_avatar;
              return (
                <div key={f.id} className="flex items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={buildAvatarDisplayUrl(friendAvatar) || undefined} />
                      <AvatarFallback className="bg-emerald-500/10 text-emerald-600 text-xs font-bold">
                        {friendName?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground">{friendName || t('common.unknown')}</span>
                  </div>
                  <DSButton variant="ghost" size="sm" onClick={() => setActiveChatFriendship(f)}>
                    <MessageCircle className="w-4 h-4" />
                  </DSButton>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Section title={t('languages.dashboard.community.suggestions')} icon={<UserPlus className="w-5 h-5 text-blue-500" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestions.map(s => {
              const alreadySent = pendingSent.some(p => p.recipient_id === s.user_id);
              return (
                <div key={s.user_id} className="flex items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={buildAvatarDisplayUrl(s.avatar_storage_path) || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {s.full_name?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="text-sm font-medium text-foreground">{s.full_name}</span>
                      {s.course_key && (
                        <p className="text-[10px] text-emerald-600">🇷🇺 {t('languages.dashboard.community.sameCourse')}</p>
                      )}
                    </div>
                  </div>
                  <DSButton
                    variant={alreadySent ? 'ghost' : 'outline'}
                    size="sm"
                    disabled={alreadySent}
                    onClick={() => sendRequest(s.user_id)}
                    className={alreadySent ? '' : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'}
                  >
                    {alreadySent ? <UserCheck className="w-4 h-4 text-muted-foreground" /> : <UserPlus className="w-4 h-4" />}
                  </DSButton>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Pending sent */}
      {pendingSent.length > 0 && (
        <Section title={t('languages.dashboard.community.pendingSent')} icon={<UserCheck className="w-5 h-5 text-muted-foreground" />}>
          <div className="space-y-2">
            {pendingSent.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={buildAvatarDisplayUrl(f.recipient_avatar) || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">{f.recipient_name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">{f.recipient_name || t('common.unknown')}</span>
                </div>
                <span className="text-xs text-muted-foreground">{t('languages.dashboard.community.pending')}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count?: number; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-2xl p-5">
      <h3 className="flex items-center gap-2 text-base font-bold text-foreground mb-4">
        {icon}
        {title}
        {count !== undefined && <span className="text-xs font-normal text-muted-foreground">({count})</span>}
      </h3>
      {children}
    </section>
  );
}

function FriendRequestCard({ name, avatar, onAccept, onReject, t }: {
  name?: string; avatar?: string; onAccept: () => void; onReject: () => void; t: (k: string) => string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl">
      <div className="flex items-center gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={buildAvatarDisplayUrl(avatar) || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{name?.[0] || '?'}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium text-foreground">{name || t('common.unknown')}</span>
      </div>
      <div className="flex gap-2">
        <DSButton size="sm" onClick={onAccept} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
          <UserCheck className="w-3.5 h-3.5" />
          {t('languages.dashboard.community.accept')}
        </DSButton>
        <DSButton variant="outline" size="sm" onClick={onReject} className="gap-1">
          <UserX className="w-3.5 h-3.5" />
          {t('languages.dashboard.community.ignore')}
        </DSButton>
      </div>
    </div>
  );
}

function PeerChatPanel({ friendship, userId, onClose }: { friendship: Friendship; userId: string; onClose: () => void }) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { messages, loading: msgsLoading } = useCommMessages(threadId);

  const isRequester = friendship.requester_id === userId;
  const friendName = isRequester ? friendship.recipient_name : friendship.requester_name;
  const friendUserId = isRequester ? friendship.recipient_id : friendship.requester_id;

  // Find or lazily create a peer_message thread for this friendship
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Check for existing thread linked to this friendship
      const { data } = await supabase.functions.invoke('comm-api', {
        body: {
          action: 'thread.list',
          filter_type: 'peer_message',
        },
      });
      const existing = (data?.threads || []).find(
        (t: any) => t.linked_entity_type === 'friendship' && t.linked_entity_id === friendship.id
      );
      if (!cancelled && existing) {
        setThreadId(existing.id);
      }
    })();
    return () => { cancelled = true; };
  }, [friendship.id]);

  const ensureThread = useCallback(async () => {
    if (threadId) return threadId;
    setCreating(true);
    try {
      const result = await commCreateThread({
        thread_type: 'peer_message',
        first_message: input.trim(),
        participants: [{ user_id: friendUserId, role: 'student' }],
        linked_entity_type: 'friendship',
        linked_entity_id: friendship.id,
      });
      if (result?.thread_id) {
        setThreadId(result.thread_id);
        return result.thread_id;
      }
    } finally {
      setCreating(false);
    }
    return null;
  }, [threadId, friendUserId, friendship.id, input]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const tid = await ensureThread();
    if (!tid) return;
    // If thread was just created, first message was already sent
    if (!creating) {
      await commSendMessage({ thread_id: tid, body: input.trim() });
    }
    setInput('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-emerald-500/5">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-bold text-foreground">{friendName}</span>
        </div>
        <DSButton variant="ghost" size="sm" onClick={onClose}>✕</DSButton>
      </div>

      <div className="h-64 overflow-y-auto p-4 space-y-2">
        {msgsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">{t('languages.dashboard.community.startConversation')}</p>
        ) : (
          messages.map((m: CommMessage) => (
            <div key={m.id} className={cn('flex', m.sender_id === userId ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[70%] px-3 py-2 rounded-2xl text-sm',
                m.sender_id === userId
                  ? 'bg-emerald-500 text-white rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              )}>
                {m.body}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={t('languages.dashboard.community.typeMessage')}
          className="flex-1 bg-muted/50 border-none rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
        <DSButton size="sm" onClick={handleSend} disabled={!input.trim() || creating} className="bg-emerald-500 hover:bg-emerald-600 text-white">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </DSButton>
      </div>
    </motion.div>
  );
}
