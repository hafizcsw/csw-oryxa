/**
 * UniversityCommWorkspace — University-side communication workspace.
 * Replaces PageInboxPanel with canonical backbone.
 */
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Inbox, MessageCircle, UserCheck, Clock, CheckCircle2, ChevronLeft,
  Loader2, Building2, Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useCommThreads, commAssignThread, commChangeStatus, commMarkRead,
  type CommThread,
} from '@/hooks/useCommApi';
import { CommThreadView } from '@/components/comm/CommThreadView';

type WorkspaceFilter = 'all' | 'public' | 'qualified' | 'application' | 'assigned_to_me' | 'awaiting_reply' | 'closed';

interface UniversityCommWorkspaceProps {
  universityId: string;
  currentUserId?: string;
}

export function UniversityCommWorkspace({ universityId, currentUserId }: UniversityCommWorkspaceProps) {
  const { t } = useTranslation();
  const { threads, loading, refresh } = useCommThreads({
    universityId,
    filterType: [
      'university_public_inquiry',
      'university_qualified_inquiry',
      'application_thread',
      'csw_support',
    ],
  });
  const [filter, setFilter] = useState<WorkspaceFilter>('all');
  const [selectedThread, setSelectedThread] = useState<CommThread | null>(null);
  const [searchQ, setSearchQ] = useState('');

  const filteredThreads = useMemo(() => {
    let result = threads;

    switch (filter) {
      case 'public':
        result = result.filter(t => t.thread_type === 'university_public_inquiry');
        break;
      case 'qualified':
        result = result.filter(t => t.thread_type === 'university_qualified_inquiry');
        break;
      case 'application':
        result = result.filter(t => t.thread_type === 'application_thread');
        break;
      case 'assigned_to_me':
        result = result.filter(t => t.assigned_to === currentUserId);
        break;
      case 'awaiting_reply':
        result = result.filter(t => t.status === 'awaiting_reply' || t.status === 'open');
        break;
      case 'closed':
        result = result.filter(t => t.status === 'closed' || t.status === 'archived');
        break;
    }

    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      result = result.filter(
        t =>
          (t.display_name || '').toLowerCase().includes(q) ||
          (t.subject || '').toLowerCase().includes(q) ||
          (t.last_message_preview || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [threads, filter, searchQ, currentUserId]);

  const counts = useMemo(() => ({
    all: threads.filter(t => t.unread_count > 0).length,
    public: threads.filter(t => t.thread_type === 'university_public_inquiry' && t.unread_count > 0).length,
    qualified: threads.filter(t => t.thread_type === 'university_qualified_inquiry' && t.unread_count > 0).length,
    application: threads.filter(t => t.thread_type === 'application_thread' && t.unread_count > 0).length,
    assigned_to_me: threads.filter(t => t.assigned_to === currentUserId && t.unread_count > 0).length,
    awaiting_reply: threads.filter(t => (t.status === 'awaiting_reply' || t.status === 'open') && t.unread_count > 0).length,
    closed: 0,
  }), [threads, currentUserId]);

  const filters: { key: WorkspaceFilter; icon: React.ReactNode; label: string }[] = [
    { key: 'all', icon: <Inbox className="w-4 h-4" />, label: t('comm.workspace.all') },
    { key: 'public', icon: <MessageCircle className="w-4 h-4" />, label: t('comm.workspace.publicInquiries') },
    { key: 'qualified', icon: <UserCheck className="w-4 h-4" />, label: t('comm.workspace.qualifiedInquiries') },
    { key: 'application', icon: <Building2 className="w-4 h-4" />, label: t('comm.workspace.applicationThreads') },
    { key: 'assigned_to_me', icon: <UserCheck className="w-4 h-4" />, label: t('comm.workspace.assignedToMe') },
    { key: 'awaiting_reply', icon: <Clock className="w-4 h-4" />, label: t('comm.workspace.awaitingReply') },
    { key: 'closed', icon: <CheckCircle2 className="w-4 h-4" />, label: t('comm.workspace.closed') },
  ];

  const handleSelectThread = useCallback((thread: CommThread) => {
    setSelectedThread(thread);
    if (thread.unread_count > 0) {
      commMarkRead(thread.id).then(() => refresh()).catch(() => {});
    }
  }, [refresh]);

  const handleAssign = async (threadId: string) => {
    if (!currentUserId) return;
    await commAssignThread(threadId, currentUserId);
    refresh();
  };

  const handleClose = async (threadId: string) => {
    await commChangeStatus(threadId, 'closed');
    refresh();
    setSelectedThread(null);
  };

  // Thread detail
  if (selectedThread) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setSelectedThread(null)} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> {t('comm.back')}
          </Button>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm truncate block">
              {selectedThread.display_name || selectedThread.subject || t('comm.noSubject')}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="outline" className="text-[9px]">
                {t(`comm.threadType.${selectedThread.thread_type}`)}
              </Badge>
              <Badge variant={selectedThread.status === 'open' ? 'default' : 'secondary'} className="text-[9px]">
                {t(`comm.status.${selectedThread.status}`)}
              </Badge>
            </div>
          </div>
          <div className="flex gap-1">
            {selectedThread.assigned_to !== currentUserId && (
              <Button size="sm" variant="outline" onClick={() => handleAssign(selectedThread.id)}>
                {t('comm.workspace.assignToMe')}
              </Button>
            )}
            {selectedThread.status !== 'closed' && (
              <Button size="sm" variant="outline" onClick={() => handleClose(selectedThread.id)}>
                {t('comm.workspace.close')}
              </Button>
            )}
          </div>
        </div>
        <CommThreadView
          threadId={selectedThread.id}
          threadType={selectedThread.thread_type}
          className="flex-1"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Filter sidebar */}
      <div className="w-48 flex-shrink-0 border-e border-border bg-muted/30 py-2">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
              filter === f.key
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted/60'
            }`}
          >
            {f.icon}
            <span className="flex-1 text-start truncate">{f.label}</span>
            {(counts[f.key] || 0) > 0 && (
              <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {counts[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Thread list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              className="flex-1 bg-transparent border-none outline-none text-sm"
              placeholder={t('comm.searchPlaceholder')}
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
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
                className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40 border-b border-border/30 ${
                  thread.unread_count > 0 ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className={`text-sm truncate block ${thread.unread_count > 0 ? 'font-semibold' : ''}`}>
                    {thread.display_name || thread.subject || t('comm.noSubject')}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {t(`comm.threadType.${thread.thread_type}`)}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      {t(`comm.status.${thread.status}`)}
                    </Badge>
                    {thread.last_message_preview && (
                      <span className="text-xs text-muted-foreground truncate">
                        {thread.last_message_preview}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {thread.last_message_at
                      ? new Date(thread.last_message_at).toLocaleDateString()
                      : ''}
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
    </div>
  );
}
