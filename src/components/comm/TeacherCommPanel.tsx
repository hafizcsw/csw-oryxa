/**
 * TeacherCommPanel — Teacher-side messaging panel using canonical comm backbone.
 * Replaces old ChatPanel for teacher dashboard.
 */
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageCircle, Search, ChevronLeft, Loader2, Inbox, Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useCommThreads, commMarkRead, commCreateThread, type CommThread,
} from '@/hooks/useCommApi';
import { CommThreadView } from '@/components/comm/CommThreadView';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface TeacherCommPanelProps {
  className?: string;
  initialConversationId?: string;
}

export function TeacherCommPanel({ className, initialConversationId }: TeacherCommPanelProps) {
  const { t } = useTranslation();
  const { threads, loading, refresh } = useCommThreads({
    filterType: ['teacher_student'],
  });
  const [selectedThread, setSelectedThread] = useState<CommThread | null>(null);
  const [searchQ, setSearchQ] = useState('');

  // Auto-select initial conversation
  const resolvedSelected = useMemo(() => {
    if (selectedThread) return selectedThread;
    if (initialConversationId) {
      return threads.find(t => t.id === initialConversationId) || null;
    }
    return null;
  }, [selectedThread, initialConversationId, threads]);

  const filteredThreads = useMemo(() => {
    if (!searchQ.trim()) return threads;
    const q = searchQ.toLowerCase();
    return threads.filter(
      t =>
        (t.display_name || '').toLowerCase().includes(q) ||
        (t.subject || '').toLowerCase().includes(q) ||
        (t.last_message_preview || '').toLowerCase().includes(q)
    );
  }, [threads, searchQ]);

  const handleSelectThread = useCallback((thread: CommThread) => {
    setSelectedThread(thread);
    if (thread.unread_count > 0) {
      commMarkRead(thread.id).then(() => refresh()).catch(() => {});
    }
  }, [refresh]);

  const totalUnread = useMemo(() => threads.reduce((sum, t) => sum + t.unread_count, 0), [threads]);

  return (
    <div className={cn(
      "flex h-[calc(100vh-8rem)] min-h-[500px] max-h-[800px] border border-border rounded-2xl overflow-hidden bg-background shadow-xl",
      className
    )}>
      {/* Sidebar */}
      <div className={cn(
        "w-[340px] border-e border-border flex-shrink-0 flex flex-col bg-card/50",
        resolvedSelected ? 'hidden md:flex' : ''
      )}>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-bold text-base text-foreground">
                {t('comm.messages')}
              </h3>
              {totalUnread > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {totalUnread}
                </Badge>
              )}
            </div>
            <NewTeacherThreadDialog onCreated={() => refresh()} />
          </div>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder={t('comm.searchPlaceholder')}
              className="ps-9 h-9 text-xs rounded-full bg-muted/50 border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Inbox className="w-10 h-10 opacity-30" />
              <p className="text-sm">{t('comm.emptyInbox')}</p>
            </div>
          ) : (
            filteredThreads.map(thread => (
              <button
                key={thread.id}
                onClick={() => handleSelectThread(thread)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40 border-b border-border/30",
                  thread.unread_count > 0 && 'bg-primary/5',
                  resolvedSelected?.id === thread.id && 'bg-primary/10'
                )}
              >
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={thread.display_avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {(thread.display_name || '?')[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className={cn("text-sm truncate block", thread.unread_count > 0 && 'font-semibold')}>
                    {thread.display_name || t('comm.noSubject')}
                  </span>
                  {thread.last_message_preview && (
                    <span className="text-xs text-muted-foreground truncate block">
                      {thread.last_message_preview}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {thread.last_message_at ? new Date(thread.last_message_at).toLocaleDateString() : ''}
                  </span>
                  {thread.unread_count > 0 && (
                    <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                      {thread.unread_count > 9 ? '9+' : thread.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat */}
      <div className={cn("flex-1 flex flex-col", !resolvedSelected ? 'hidden md:flex' : '')}>
        {resolvedSelected ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border md:hidden">
              <Button variant="ghost" size="sm" onClick={() => setSelectedThread(null)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-medium text-sm truncate">
                {resolvedSelected.display_name || t('comm.noSubject')}
              </span>
            </div>
            <CommThreadView
              threadId={resolvedSelected.id}
              threadType={resolvedSelected.thread_type}
              subject={resolvedSelected.subject || undefined}
              className="flex-1"
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <MessageCircle className="h-14 w-14 opacity-20" />
            <p className="text-sm">{t('comm.selectThread')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Dialog for teachers to start a new conversation with a student */
function NewTeacherThreadDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<Array<{ user_id: string; full_name: string | null; avatar_storage_path: string | null }>>([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const loadStudents = async () => {
    setLoadingStudents(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Get students assigned to this teacher
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_storage_path')
      .neq('user_id', user.id)
      .order('full_name')
      .limit(100);
    setStudents(data || []);
    setLoadingStudents(false);
  };

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(s => (s.full_name || '').toLowerCase().includes(q));
  }, [students, search]);

  const handleCreate = async () => {
    if (!selectedStudent || !message.trim()) return;
    setSending(true);
    try {
      await commCreateThread({
        thread_type: 'teacher_student',
        first_message: message.trim(),
        participants: [{ user_id: selectedStudent, role: 'student' }],
      });
      setOpen(false);
      setMessage('');
      setSelectedStudent(null);
      onCreated();
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) loadStudents(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('comm.newConversation')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder={t('comm.searchStudents')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto space-y-1">
            {loadingStudents ? (
              <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
            ) : filteredStudents.map(s => (
              <button
                key={s.user_id}
                onClick={() => setSelectedStudent(s.user_id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                  selectedStudent === s.user_id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                )}
              >
                <Avatar className="w-7 h-7">
                  <AvatarImage src={s.avatar_storage_path || undefined} />
                  <AvatarFallback className="text-[10px]">{(s.full_name || '?')[0]}</AvatarFallback>
                </Avatar>
                <span className="truncate">{s.full_name || s.user_id.slice(0, 8)}</span>
              </button>
            ))}
          </div>
          {selectedStudent && (
            <Textarea
              placeholder={t('comm.typePlaceholder')}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="min-h-[60px]"
            />
          )}
          <Button
            onClick={handleCreate}
            disabled={!selectedStudent || !message.trim() || sending}
            className="w-full"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('comm.send')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
