/**
 * StudentInbox — Facebook Messenger-style three-panel unified inbox.
 * Panel 1: Category sidebar (narrow icons + labels)
 * Panel 2: Thread list (conversations)
 * Panel 3: Active conversation view
 * Mobile: stacked panels with back navigation.
 */
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageCircle, Search, Building2, GraduationCap, ShieldAlert,
  Bell, Inbox, Archive, Loader2, FileText, HeadphonesIcon,
  MailOpen, Plus, X, Users, MessageSquare,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useCommThreads, commMarkRead, type CommThread } from '@/hooks/useCommApi';
import { CommThreadView } from '@/components/comm/CommThreadView';
import { cn } from '@/lib/utils';

type FilterCategory =
  | 'all' | 'unread' | 'csw' | 'universities' | 'teachers'
  | 'applications' | 'security' | 'system' | 'archived';

const CATEGORY_TYPES: Record<string, string[]> = {
  csw: ['csw_support', 'file_improvement'],
  universities: ['university_public_inquiry', 'university_qualified_inquiry'],
  teachers: ['teacher_student', 'peer_message'],
  applications: ['application_thread'],
  security: ['security_notice'],
  system: ['system_notice'],
};

const CATEGORY_ICONS: Record<FilterCategory, React.ElementType> = {
  all: Inbox,
  unread: MailOpen,
  csw: HeadphonesIcon,
  universities: Building2,
  teachers: GraduationCap,
  applications: FileText,
  security: ShieldAlert,
  system: Bell,
  archived: Archive,
};

const THREAD_TYPE_COLORS: Record<string, string> = {
  csw_support: 'bg-amber-500',
  file_improvement: 'bg-amber-400',
  university_public_inquiry: 'bg-blue-500',
  university_qualified_inquiry: 'bg-blue-600',
  teacher_student: 'bg-purple-500',
  peer_message: 'bg-purple-400',
  application_thread: 'bg-emerald-500',
  security_notice: 'bg-red-500',
  system_notice: 'bg-muted-foreground',
};

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function threadTypeIcon(type: string): React.ReactNode {
  if (['csw_support', 'file_improvement'].includes(type)) return <HeadphonesIcon className="w-3.5 h-3.5 text-white" />;
  if (['university_public_inquiry', 'university_qualified_inquiry'].includes(type)) return <Building2 className="w-3.5 h-3.5 text-white" />;
  if (['teacher_student', 'peer_message'].includes(type)) return <GraduationCap className="w-3.5 h-3.5 text-white" />;
  if (type === 'application_thread') return <FileText className="w-3.5 h-3.5 text-white" />;
  if (type === 'security_notice') return <ShieldAlert className="w-3.5 h-3.5 text-white" />;
  if (type === 'system_notice') return <Bell className="w-3.5 h-3.5 text-white" />;
  return <MessageCircle className="w-3.5 h-3.5 text-white" />;
}

export function StudentInbox() {
  const { t, i18n } = useTranslation();
  const { threads, loading, refresh } = useCommThreads();
  const [category, setCategory] = useState<FilterCategory>('all');
  const [selectedThread, setSelectedThread] = useState<CommThread | null>(null);
  const [searchQ, setSearchQ] = useState('');

  const locale = i18n.language || 'en';

  const formatTime = useCallback((dateStr: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return t('comm.yesterday');
    if (diffDays < 7) return d.toLocaleDateString(locale, { weekday: 'short' });
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }, [locale, t]);

  const filteredThreads = useMemo(() => {
    let filtered = threads;
    if (category === 'unread') filtered = filtered.filter(th => th.unread_count > 0);
    else if (category === 'archived') filtered = filtered.filter(th => th.status === 'archived');
    else if (category !== 'all') {
      const types = CATEGORY_TYPES[category] || [];
      filtered = filtered.filter(th => types.includes(th.thread_type));
    }
    if (category !== 'archived') filtered = filtered.filter(th => th.status !== 'archived');
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      filtered = filtered.filter(th =>
        (th.display_name || '').toLowerCase().includes(q) ||
        (th.subject || '').toLowerCase().includes(q) ||
        (th.last_message_preview || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [threads, category, searchQ]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of Object.keys(CATEGORY_TYPES)) {
      const types = CATEGORY_TYPES[cat];
      counts[cat] = threads.filter(th => types.includes(th.thread_type) && th.unread_count > 0).length;
    }
    counts.unread = threads.filter(th => th.unread_count > 0).length;
    counts.all = counts.unread;
    return counts;
  }, [threads]);

  const totalUnread = categoryCounts.unread || 0;

  const handleSelectThread = useCallback((thread: CommThread) => {
    setSelectedThread(thread);
    if (thread.unread_count > 0) {
      commMarkRead(thread.id).then(() => refresh()).catch(() => {});
    }
  }, [refresh]);

  // ──────────────── RENDER ────────────────
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full rounded-2xl overflow-hidden border border-border/60 shadow-lg bg-background">

        {/* ═══════ PANEL 1: Category Sidebar (Facebook-style narrow icons) ═══════ */}
        <div className={cn(
          'flex-shrink-0 border-e border-border/40 bg-muted/30 flex-col',
          'hidden md:flex',
          'w-[68px]'
        )}>
          {/* Logo / brand area */}
          <div className="h-[60px] flex items-center justify-center border-b border-border/30">
            <div className="relative">
              <MessageSquare className="w-6 h-6 text-primary" />
              {totalUnread > 0 && (
                <span className="absolute -top-1.5 -end-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </div>
          </div>

          {/* Category icons */}
          <nav className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto">
            {(Object.keys(CATEGORY_ICONS) as FilterCategory[]).map(cat => {
              const Icon = CATEGORY_ICONS[cat];
              const isActive = category === cat;
              const count = categoryCounts[cat] || 0;

              return (
                <Tooltip key={cat}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setCategory(cat)}
                      className={cn(
                        'relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {count > 0 && !isActive && (
                        <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1">
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {t(`comm.category.${cat}`)}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Compose at bottom */}
          <div className="py-3 flex justify-center border-t border-border/30">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {t('comm.newMessage')}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ═══════ PANEL 2: Thread List ═══════ */}
        <div className={cn(
          'flex flex-col border-e border-border/40 bg-background min-w-0',
          // On desktop: always visible, fixed width
          'md:w-[340px] md:flex-shrink-0',
          // On mobile: full width when no thread selected, hidden when thread selected
          selectedThread ? 'hidden md:flex' : 'flex-1 md:flex-initial'
        )}>
          {/* Thread list header */}
          <div className="h-[60px] flex items-center gap-3 px-4 border-b border-border/30">
            <h2 className="text-lg font-bold flex-1">{t('comm.title')}</h2>
          </div>

          {/* Mobile category chips */}
          <div className="md:hidden flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-border/20 scrollbar-none">
            {(Object.keys(CATEGORY_ICONS) as FilterCategory[]).map(cat => {
              const count = categoryCounts[cat] || 0;
              return (
                <Badge
                  key={cat}
                  variant={category === cat ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer whitespace-nowrap text-xs py-1 px-3 rounded-full transition-all',
                    category === cat && 'shadow-sm'
                  )}
                  onClick={() => setCategory(cat)}
                >
                  {t(`comm.category.${cat}`)}
                  {count > 0 && ` · ${count}`}
                </Badge>
              );
            })}
          </div>

          {/* Search */}
          <div className="px-3 py-2.5">
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-200',
              'bg-muted/50 hover:bg-muted/70 focus-within:bg-muted/70 focus-within:ring-1 focus-within:ring-primary/30'
            )}>
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/50"
                placeholder={t('comm.searchPlaceholder')}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              {searchQ && (
                <button onClick={() => setSearchQ('')} className="text-muted-foreground hover:text-foreground p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">{t('comm.loading')}</span>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 px-6">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <Inbox className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{t('comm.emptyInbox')}</p>
                <p className="text-xs text-muted-foreground/60 text-center">{t('comm.emptyInboxHint')}</p>
              </div>
            ) : (
              filteredThreads.map(thread => {
                const isUnread = thread.unread_count > 0;
                const isSelected = selectedThread?.id === thread.id;
                const dotColor = THREAD_TYPE_COLORS[thread.thread_type] || 'bg-muted-foreground';

                return (
                  <button
                    key={thread.id}
                    onClick={() => handleSelectThread(thread)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 transition-all duration-150 relative',
                      'hover:bg-muted/40',
                      isSelected && 'bg-primary/8',
                      isUnread && !isSelected && 'bg-primary/[0.02]'
                    )}
                  >
                    {/* Avatar with type indicator */}
                    <div className="relative flex-shrink-0">
                      <Avatar className={cn(
                        'h-12 w-12',
                        isSelected && 'ring-2 ring-primary/40'
                      )}>
                        <AvatarFallback className={cn(
                          'text-sm font-semibold',
                          isUnread || isSelected
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {getInitials(thread.display_name || thread.subject || '?')}
                        </AvatarFallback>
                      </Avatar>
                      {/* Type indicator dot */}
                      <div className={cn(
                        'absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-background',
                        dotColor
                      )}>
                        {threadTypeIcon(thread.thread_type)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 text-start">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          'text-sm truncate',
                          isUnread || isSelected ? 'font-bold text-foreground' : 'font-medium text-foreground/80'
                        )}>
                          {thread.display_name || thread.subject || t('comm.noSubject')}
                        </span>
                        <span className={cn(
                          'text-[11px] flex-shrink-0 tabular-nums',
                          isUnread ? 'text-primary font-semibold' : 'text-muted-foreground'
                        )}>
                          {formatTime(thread.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={cn(
                          'text-xs truncate leading-relaxed max-w-[85%]',
                          isUnread ? 'text-foreground/70 font-medium' : 'text-muted-foreground'
                        )}>
                          {thread.last_message_preview || t(`comm.threadType.${thread.thread_type}`)}
                        </span>
                        {isUnread && (
                          <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5 flex-shrink-0">
                            {thread.unread_count > 9 ? '9+' : thread.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ═══════ PANEL 3: Conversation View ═══════ */}
        <div className={cn(
          'flex-1 flex flex-col min-w-0 bg-background',
          // On mobile: only visible when a thread is selected
          selectedThread ? 'flex' : 'hidden md:flex'
        )}>
          {selectedThread ? (
            <>
              {/* Conversation header */}
              <div className="h-[60px] flex items-center gap-3 px-4 border-b border-border/30 bg-background">
                {/* Mobile back button */}
                <button
                  onClick={() => setSelectedThread(null)}
                  className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <svg className="w-5 h-5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                    {getInitials(selectedThread.display_name || selectedThread.subject || '?')}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">
                      {selectedThread.display_name || selectedThread.subject || t('comm.noSubject')}
                    </span>
                    {selectedThread.priority === 'urgent' && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 animate-pulse">
                        {t('comm.urgent')}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t(`comm.threadType.${selectedThread.thread_type}`)}
                  </span>
                </div>
              </div>

              {/* Messages area */}
              <CommThreadView
                threadId={selectedThread.id}
                threadType={selectedThread.thread_type}
                subject={selectedThread.subject || undefined}
                className="flex-1"
              />
            </>
          ) : (
            /* Empty state when no thread is selected (desktop only) */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
              <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-lg font-semibold text-muted-foreground/60">{t('comm.title')}</p>
                <p className="text-sm text-muted-foreground/40 mt-1">{t('comm.noConversationSelected')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
