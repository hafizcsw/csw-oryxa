/**
 * StudentInbox — Messenger-style three-panel inbox built on the SAME unified
 * source as the FAB MessagesTab (`useUnifiedInbox`). Aggregates:
 *   • CRM support_cases (old + new) → opened via SupportThread
 *   • comm_threads (teacher / university / peer / application / csw / other)
 *     → opened via CommThreadView
 *
 * No duplication, no fake rows, no parallel data path. All surfaces
 * (FAB, /account?tab=messages, /messages) read from useUnifiedInbox.
 */
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageCircle, Search, Building2, GraduationCap, ShieldAlert,
  Bell, Inbox, Archive, Loader2, FileText, HeadphonesIcon,
  MailOpen, Plus, X, Users, MessageSquare, LifeBuoy, School,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useUnifiedInbox, type InboxSource, type UnifiedInboxItem } from '@/hooks/useUnifiedInbox';
import { CommThreadView } from '@/components/comm/CommThreadView';
import { SupportThread } from '@/features/support/SupportThread';
import { commMarkRead } from '@/hooks/useCommApi';
import { cn } from '@/lib/utils';

type FilterCategory = 'all' | 'unread' | InboxSource | 'archived';

const SOURCE_META: Record<InboxSource, { Icon: typeof LifeBuoy; dot: string }> = {
  support:     { Icon: LifeBuoy,      dot: 'bg-amber-500' },
  teacher:     { Icon: GraduationCap, dot: 'bg-purple-500' },
  university:  { Icon: School,        dot: 'bg-blue-500' },
  peer:        { Icon: Users,         dot: 'bg-green-500' },
  application: { Icon: FileText,      dot: 'bg-emerald-500' },
  csw:         { Icon: Building2,     dot: 'bg-muted-foreground' },
  other:       { Icon: MessageSquare, dot: 'bg-muted-foreground' },
};

const CATEGORY_ORDER: FilterCategory[] = [
  'all', 'unread', 'support', 'teacher', 'university',
  'peer', 'application', 'csw', 'archived',
];

const CATEGORY_ICONS: Record<FilterCategory, React.ElementType> = {
  all: Inbox,
  unread: MailOpen,
  support: LifeBuoy,
  teacher: GraduationCap,
  university: School,
  peer: Users,
  application: FileText,
  csw: Building2,
  other: MessageSquare,
  archived: Archive,
};

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export function StudentInbox() {
  const { t, i18n } = useTranslation();
  const { items, loading, refresh } = useUnifiedInbox();
  const [category, setCategory] = useState<FilterCategory>('all');
  const [selected, setSelected] = useState<UnifiedInboxItem | null>(null);
  const [searchQ, setSearchQ] = useState('');

  const locale = i18n.language || 'en';

  const formatTime = useCallback((dateStr: string | null): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return t('comm.yesterday');
    if (diffDays < 7) return d.toLocaleDateString(locale, { weekday: 'short' });
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }, [locale, t]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (category === 'archived') list = list.filter(i => i.isClosed);
    else list = list.filter(i => !i.isClosed);

    if (category === 'unread') list = list.filter(i => i.unread);
    else if (category !== 'all' && category !== 'archived') {
      list = list.filter(i => i.source === category);
    }

    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.preview || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, category, searchQ]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    const open = items.filter(i => !i.isClosed);
    c.unread = open.filter(i => i.unread).length;
    c.all = c.unread;
    for (const src of Object.keys(SOURCE_META) as InboxSource[]) {
      c[src] = open.filter(i => i.source === src && i.unread).length;
    }
    c.archived = items.filter(i => i.isClosed).length;
    return c;
  }, [items]);

  const totalUnread = categoryCounts.unread || 0;

  const handleSelect = useCallback((item: UnifiedInboxItem) => {
    setSelected(item);
    if (item.raw.kind === 'comm' && item.unread) {
      commMarkRead(item.nativeId).then(() => refresh()).catch(() => {});
    }
  }, [refresh]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full rounded-2xl overflow-hidden border border-border/60 shadow-lg bg-background">

        {/* PANEL 1: Category Sidebar */}
        <div className="flex-shrink-0 border-e border-border/40 bg-muted/30 hidden md:flex flex-col w-[68px]">
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

          <nav className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto">
            {CATEGORY_ORDER.map(cat => {
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
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {count > 0 && !isActive && cat !== 'archived' && (
                        <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1">
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {t(`comm.category.${cat}`, { defaultValue: cat })}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

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

        {/* PANEL 2: Thread List */}
        <div className={cn(
          'flex flex-col border-e border-border/40 bg-background min-w-0',
          'md:w-[340px] md:flex-shrink-0',
          selected ? 'hidden md:flex' : 'flex-1 md:flex-initial',
        )}>
          <div className="h-[60px] flex items-center gap-3 px-4 border-b border-border/30">
            <h2 className="text-lg font-bold flex-1">{t('comm.title')}</h2>
          </div>

          {/* Mobile category chips */}
          <div className="md:hidden flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-border/20 scrollbar-none">
            {CATEGORY_ORDER.map(cat => {
              const count = categoryCounts[cat] || 0;
              return (
                <Badge
                  key={cat}
                  variant={category === cat ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer whitespace-nowrap text-xs py-1 px-3 rounded-full transition-all',
                    category === cat && 'shadow-sm',
                  )}
                  onClick={() => setCategory(cat)}
                >
                  {t(`comm.category.${cat}`, { defaultValue: cat })}
                  {count > 0 && cat !== 'archived' && ` · ${count}`}
                </Badge>
              );
            })}
          </div>

          {/* Search */}
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-muted/50 hover:bg-muted/70 focus-within:bg-muted/70 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
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

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">{t('comm.loading')}</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 px-6">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <Inbox className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{t('comm.emptyInbox')}</p>
                <p className="text-xs text-muted-foreground/60 text-center">{t('comm.emptyInboxHint')}</p>
              </div>
            ) : (
              filteredItems.map(item => {
                const isSelected = selected?.key === item.key;
                const meta = SOURCE_META[item.source];
                const SrcIcon = meta.Icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 transition-all duration-150 relative hover:bg-muted/40',
                      isSelected && 'bg-primary/8',
                      item.unread && !isSelected && 'bg-primary/[0.02]',
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className={cn('h-12 w-12', isSelected && 'ring-2 ring-primary/40')}>
                        <AvatarFallback className={cn(
                          'text-sm font-semibold',
                          item.unread || isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                        )}>
                          {getInitials(item.title || '?')}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        'absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-background',
                        meta.dot,
                      )}>
                        <SrcIcon className="w-3 h-3 text-white" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 text-start">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          'text-sm truncate',
                          item.unread || isSelected ? 'font-bold text-foreground' : 'font-medium text-foreground/80',
                        )}>
                          {item.title || t('comm.noSubject')}
                        </span>
                        <span className={cn(
                          'text-[11px] flex-shrink-0 tabular-nums',
                          item.unread ? 'text-primary font-semibold' : 'text-muted-foreground',
                        )}>
                          {formatTime(item.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={cn(
                          'text-xs truncate leading-relaxed max-w-[85%]',
                          item.unread ? 'text-foreground/70 font-medium' : 'text-muted-foreground',
                        )}>
                          {item.preview || t(`comm.category.${item.source}`, { defaultValue: item.source })}
                          {item.isClosed && (
                            <span className="ms-1 text-muted-foreground/60">
                              · {t('portal.support.panel.messages.closed', { defaultValue: 'closed' })}
                            </span>
                          )}
                        </span>
                        {item.unread && (
                          <span className="min-w-[8px] h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* PANEL 3: Conversation View — routes by source */}
        <div className={cn(
          'flex-1 flex flex-col min-w-0 bg-background',
          selected ? 'flex' : 'hidden md:flex',
        )}>
          {selected ? (
            <>
              <div className="h-[60px] flex items-center gap-3 px-4 border-b border-border/30 bg-background">
                <button
                  onClick={() => setSelected(null)}
                  className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                  aria-label="Back"
                >
                  <svg className="w-5 h-5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                    {getInitials(selected.title || '?')}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">
                      {selected.title || t('comm.noSubject')}
                    </span>
                    {selected.isClosed && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {t('portal.support.panel.messages.closed', { defaultValue: 'closed' })}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {t(`portal.support.panel.messages.source.${selected.source}`, { defaultValue: selected.source })}
                  </span>
                </div>
              </div>

              {selected.raw.kind === 'support' ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <SupportThread caseId={selected.nativeId} embedded />
                </div>
              ) : (
                <CommThreadView
                  threadId={selected.nativeId}
                  threadType={selected.raw.thread.thread_type}
                  subject={selected.raw.thread.subject || undefined}
                  className="flex-1"
                />
              )}
            </>
          ) : (
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
