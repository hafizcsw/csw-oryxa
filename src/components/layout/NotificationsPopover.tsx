/**
 * NotificationsPopover — Facebook-style notifications panel.
 * Aggregates: identity verification updates, unread support/messages threads,
 * and any system notices coming through the comm backbone.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  ShieldCheck,
  ShieldAlert,
  MessageCircle,
  LifeBuoy,
  MoreHorizontal,
  Check,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCommThreads, commMarkRead, type CommThread } from '@/hooks/useCommApi';
import { useIdentityStatus } from '@/hooks/useIdentityStatus';

type NotifTab = 'all' | 'unread';

interface NotifItem {
  id: string;
  kind: 'identity' | 'support' | 'message' | 'system';
  title: string;
  preview?: string;
  time: string;       // ISO
  unread: boolean;
  onClick: () => void;
}

function relativeTime(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return locale.startsWith('ar') ? 'الآن' : 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.round(d / 7);
  return `${w}w`;
}

const KIND_STYLES: Record<NotifItem['kind'], { bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  identity: { bg: 'bg-amber-500', icon: ShieldCheck },
  support:  { bg: 'bg-blue-500',  icon: LifeBuoy },
  message:  { bg: 'bg-emerald-500', icon: MessageCircle },
  system:   { bg: 'bg-rose-500',  icon: Bell },
};

export function NotificationsPopover() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language || 'en';

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotifTab>('all');

  const { threads, refresh: refreshThreads } = useCommThreads();
  const { status: identity } = useIdentityStatus();

  const items = useMemo<NotifItem[]>(() => {
    const list: NotifItem[] = [];

    // Identity-related notification
    if (identity?.identity_status && identity.identity_status !== 'none') {
      const s = identity.identity_status;
      const decidedAt = identity.decided_at || new Date().toISOString();
      let title = '';
      if (s === 'approved') {
        title = t('notifications.identity.approved', { defaultValue: 'Your identity has been verified' });
      } else if (s === 'rejected') {
        title = t('notifications.identity.rejected', { defaultValue: 'Identity verification needs your attention' });
      } else if (s === 'pending') {
        title = t('notifications.identity.pending', { defaultValue: 'Your identity is under review' });
      } else {
        title = t('notifications.identity.update', { defaultValue: 'Identity status update' });
      }
      list.push({
        id: `identity-${s}-${decidedAt}`,
        kind: 'identity',
        title,
        time: decidedAt,
        unread: s !== 'approved',
        onClick: () => {
          setOpen(false);
          navigate('/portal/identity');
        },
      });
    }

    // Threads → unread → notification
    threads.forEach((th: CommThread) => {
      if ((th.unread_count ?? 0) <= 0) return;
      const isSupport = th.thread_type === 'support' || th.thread_type === 'system_notice' || th.thread_type === 'security_notice';
      list.push({
        id: `thread-${th.id}`,
        kind: isSupport ? 'support' : 'message',
        title: th.display_name || th.subject || (isSupport
          ? t('notifications.support.title', { defaultValue: 'New message from Support' })
          : t('notifications.message.title', { defaultValue: 'New message' })),
        preview: th.last_message_preview || undefined,
        time: th.last_message_at || th.updated_at || th.created_at,
        unread: true,
        onClick: async () => {
          setOpen(false);
          try { await commMarkRead(th.id); } catch { /* ignore */ }
          await refreshThreads();
          navigate('/messages');
        },
      });
    });

    // Sort newest first
    list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return list;
  }, [threads, identity, t, navigate, refreshThreads]);

  const visible = tab === 'unread' ? items.filter(i => i.unread) : items;
  const unreadCount = items.filter(i => i.unread).length;

  const markAll = async () => {
    const unreadThreads = threads.filter(th => (th.unread_count ?? 0) > 0);
    await Promise.all(unreadThreads.map(th => commMarkRead(th.id).catch(() => {})));
    refreshThreads();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative rounded-full transition-all h-8 w-8 sm:h-9 sm:w-9',
            open ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground/80',
          )}
          title={t('notifications.title', { defaultValue: 'Notifications' })}
          aria-label={t('notifications.title', { defaultValue: 'Notifications' })}
        >
          <Bell className="w-[18px] h-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 leading-none ring-2 ring-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={0}
        collisionPadding={0}
        style={{ position: 'fixed', top: '64px', right: '8px', left: 'auto', transform: 'none' }}
        className="w-[380px] max-w-[calc(100vw-1rem)] p-0 rounded-2xl shadow-2xl border-border overflow-hidden"
      >
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col max-h-[70vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h3 className="text-[20px] font-bold tracking-tight text-foreground">
                {t('notifications.title', { defaultValue: 'Notifications' })}
              </h3>
              <button
                type="button"
                onClick={markAll}
                disabled={unreadCount === 0}
                className="h-8 w-8 rounded-full flex items-center justify-center text-foreground/70 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                aria-label={t('notifications.markAllRead', { defaultValue: 'Mark all as read' })}
                title={t('notifications.markAllRead', { defaultValue: 'Mark all as read' })}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1.5 px-3 pb-2">
              {(['all', 'unread'] as NotifTab[]).map((k) => {
                const active = tab === k;
                const label = k === 'all'
                  ? t('notifications.tabs.all', { defaultValue: 'All' })
                  : t('notifications.tabs.unread', { defaultValue: 'Unread' });
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={cn(
                      'h-8 px-3.5 rounded-full text-[13px] font-semibold transition-colors',
                      active
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted/60 text-foreground/70 hover:bg-muted',
                    )}
                  >
                    {label}
                    {k === 'unread' && unreadCount > 0 && (
                      <span className="ms-1 text-[11px]">({unreadCount})</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-1.5 pb-2 [scrollbar-width:thin]">
              {visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {tab === 'unread'
                      ? t('notifications.empty.unread', { defaultValue: 'You\'re all caught up' })
                      : t('notifications.empty.all', { defaultValue: 'No notifications yet' })}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    {t('notifications.empty.subtitle', {
                      defaultValue: 'New activity will appear here.',
                    })}
                  </p>
                </div>
              ) : (
                <div className="px-1">
                  {/* Section: New (unread) */}
                  {tab === 'all' && unreadCount > 0 && (
                    <SectionLabel label={t('notifications.section.new', { defaultValue: 'New' })} />
                  )}
                  {visible
                    .filter(i => tab === 'unread' ? true : i.unread)
                    .map(item => (
                      <NotifRow key={item.id} item={item} locale={locale} />
                    ))}

                  {/* Section: Earlier (read) */}
                  {tab === 'all' && items.some(i => !i.unread) && (
                    <>
                      <SectionLabel label={t('notifications.section.earlier', { defaultValue: 'Earlier' })} />
                      {items.filter(i => !i.unread).map(item => (
                        <NotifRow key={item.id} item={item} locale={locale} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-3 py-2 bg-card/40">
              <button
                type="button"
                onClick={() => { setOpen(false); navigate('/portal'); }}
                className="w-full text-center text-[12.5px] font-semibold text-primary hover:underline py-1"
              >
                {t('notifications.seeAll', { defaultValue: 'See all notifications' })}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-2.5 pt-2 pb-1">
      <p className="text-[15px] font-bold text-foreground">{label}</p>
    </div>
  );
}

function NotifRow({ item, locale }: { item: NotifItem; locale: string }) {
  const { bg, icon: Icon } = KIND_STYLES[item.kind];
  return (
    <button
      type="button"
      onClick={item.onClick}
      className={cn(
        'w-full flex items-start gap-3 px-2.5 py-2.5 rounded-xl text-start transition-colors',
        'hover:bg-muted/60',
      )}
    >
      <div className="relative flex-shrink-0">
        <div className={cn('h-12 w-12 rounded-full flex items-center justify-center text-white shadow-sm', bg)}>
          <Icon className="h-5 w-5" />
        </div>
        {item.kind === 'identity' && (
          <span className="absolute -bottom-0.5 -end-0.5 h-5 w-5 rounded-full bg-card border border-border flex items-center justify-center">
            {item.unread ? <ShieldAlert className="h-3 w-3 text-amber-500" /> : <Check className="h-3 w-3 text-emerald-500" />}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[13.5px] leading-snug',
          item.unread ? 'font-semibold text-foreground' : 'font-normal text-foreground/85',
        )}>
          {item.title}
        </p>
        {item.preview && (
          <p className="text-[12px] text-muted-foreground truncate mt-0.5">{item.preview}</p>
        )}
        <p className={cn(
          'text-[11.5px] mt-0.5',
          item.unread ? 'text-primary font-semibold' : 'text-muted-foreground',
        )}>
          {relativeTime(item.time, locale)}
        </p>
      </div>
      {item.unread && (
        <span className="mt-2 h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" aria-label="unread" />
      )}
    </button>
  );
}
