/**
 * NotificationsPopover — Facebook-style notifications panel.
 * Source of truth = public.portal_notifications (persistent, capped at 50).
 * Live signals (identity status, comm threads) are upserted into the table
 * by usePortalNotifications, so notifications survive sessions and reads.
 */
import { useEffect, useRef, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePortalNotifications, type PortalNotification } from '@/hooks/usePortalNotifications';
import { relativeTime } from '@/lib/notifTime';

type NotifTab = 'all' | 'unread';

const KIND_STYLES: Record<PortalNotification['kind'], { bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  identity: { bg: 'bg-amber-500', icon: ShieldCheck },
  support: { bg: 'bg-blue-500', icon: LifeBuoy },
  message: { bg: 'bg-emerald-500', icon: MessageCircle },
  system: { bg: 'bg-rose-500', icon: Bell },
};

export function NotificationsPopover() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language || 'en';
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotifTab>('all');
  const [expanded, setExpanded] = useState(false);

  const INITIAL_COUNT = 5;

  const { items, unreadCount, markRead, markAllRead } = usePortalNotifications();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const visible = tab === 'unread' ? items.filter((i) => !i.read_at) : items;

  const handleClick = async (n: PortalNotification) => {
    setOpen(false);
    if (!n.read_at) await markRead(n.id);
    if (n.link_path) navigate(n.link_path);
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'relative rounded-full transition-all h-8 w-8 sm:h-9 sm:w-9',
          open ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground/80',
        )}
        title={t('notifications.title', { defaultValue: 'Notifications' })}
        aria-label={t('notifications.title', { defaultValue: 'Notifications' })}
        aria-expanded={open}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 leading-none ring-2 ring-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed top-16 right-2 z-[1302] w-[380px] max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
          >
            <div className="flex flex-col max-h-[70vh]">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <h3 className="text-[20px] font-bold tracking-tight text-foreground">
                  {t('notifications.title', { defaultValue: 'Notifications' })}
                </h3>
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-foreground/70 hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  aria-label={t('notifications.markAllRead', { defaultValue: 'Mark all as read' })}
                  title={t('notifications.markAllRead', { defaultValue: 'Mark all as read' })}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

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
                        active ? 'bg-primary/15 text-primary' : 'bg-muted/60 text-foreground/70 hover:bg-muted',
                      )}
                    >
                      {label}
                      {k === 'unread' && unreadCount > 0 && <span className="ms-1 text-[11px]">({unreadCount})</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto px-1.5 pb-2 [scrollbar-width:thin]">
                {visible.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {tab === 'unread'
                        ? t('notifications.empty.unread', { defaultValue: "You're all caught up" })
                        : t('notifications.empty.all', { defaultValue: 'No notifications yet' })}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-1">
                      {t('notifications.empty.subtitle', { defaultValue: 'New activity will appear here.' })}
                    </p>
                  </div>
                ) : (
                  <div className="px-1">
                    {(() => {
                      const unreadItems = visible.filter((i) => !i.read_at);
                      const earlierItems = tab === 'all' ? items.filter((i) => i.read_at) : [];
                      const combined = tab === 'all' ? [...unreadItems, ...earlierItems] : unreadItems;
                      const limited = expanded ? combined : combined.slice(0, INITIAL_COUNT);

                      const limitedUnread = limited.filter((i) => !i.read_at);
                      const limitedEarlier = limited.filter((i) => i.read_at);

                      return (
                        <>
                          {tab === 'all' && limitedUnread.length > 0 && (
                            <SectionLabel label={t('notifications.section.new', { defaultValue: 'New' })} />
                          )}
                          {(tab === 'unread' ? limited : limitedUnread).map((item) => (
                            <NotifRow key={item.id} item={item} locale={locale} onClick={handleClick} />
                          ))}

                          {tab === 'all' && limitedEarlier.length > 0 && (
                            <>
                              <SectionLabel label={t('notifications.section.earlier', { defaultValue: 'Earlier' })} />
                              {limitedEarlier.map((item) => (
                                <NotifRow key={item.id} item={item} locale={locale} onClick={handleClick} />
                              ))}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {(() => {
                const total = tab === 'unread' ? visible.length : items.length;
                if (total <= INITIAL_COUNT) return null;
                return (
                  <div className="border-t border-border px-3 py-2 bg-card/40">
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => !v)}
                      className="w-full text-center text-[12.5px] font-semibold text-primary hover:underline py-1"
                    >
                      {expanded
                        ? t('notifications.showLess', { defaultValue: 'Show less' })
                        : t('notifications.seeAll', { defaultValue: 'See all notifications' })}
                    </button>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-2.5 pt-2 pb-1">
      <p className="text-[15px] font-bold text-foreground">{label}</p>
    </div>
  );
}

function NotifRow({
  item,
  locale,
  onClick,
}: {
  item: PortalNotification;
  locale: string;
  onClick: (n: PortalNotification) => void;
}) {
  const { bg, icon: Icon } = KIND_STYLES[item.kind];
  const unread = !item.read_at;
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
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
            {unread ? <ShieldAlert className="h-3 w-3 text-amber-500" /> : <Check className="h-3 w-3 text-emerald-500" />}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-[13.5px] leading-snug',
            unread ? 'font-semibold text-foreground' : 'font-normal text-foreground/85',
          )}
        >
          {item.title}
        </p>
        {item.preview && <p className="text-[12px] text-muted-foreground truncate mt-0.5">{item.preview}</p>}
        <p className={cn('text-[11.5px] mt-0.5', unread ? 'text-primary font-semibold' : 'text-muted-foreground')}>
          {relativeTime(item.created_at, locale)}
        </p>
      </div>
      {unread && <span className="mt-2 h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" aria-label="unread" />}
    </button>
  );
}
