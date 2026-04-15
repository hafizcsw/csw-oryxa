/**
 * BusuuNavBar — Facebook-inspired horizontal top navigation bar.
 * Uses the site's original HeaderAuth for avatar + dropdown menu.
 */
import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Flame, Bell, UsersRound, BellOff, CheckCheck, BookOpen, Trophy, Zap, Moon, Sun, Globe, ChevronDown, Home } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HeaderAuth } from '@/components/layout/HeaderAuth';
import { useTheme } from 'next-themes';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useNavigate } from 'react-router-dom';

export interface BusuuNavTab {
  id: string;
  icon: LucideIcon;
  labelKey: string;
  badge?: number;
}

export interface NavNotification {
  id: string;
  type: 'friend_request' | 'session' | 'assignment' | 'absence' | 'teacher' | 'general';
  titleKey: string;
  descriptionKey?: string;
  timestamp?: string;
  read?: boolean;
  actionTabId?: string;
}

interface BusuuNavBarProps {
  tabs: BusuuNavTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  streakDays?: number;
  progressPercent?: number;
  notificationCount?: number;
  courseLabel?: string;
  languageFlag?: string;
  pendingFriendRequests?: number;
  notifications?: NavNotification[];
  vocabCount?: number;
  completedLessons?: number;
  totalLessons?: number;
}

function ProgressRingSmall({ percent, size = 28 }: { percent: number; size?: number }) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const o = c - (percent / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1877F2" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={o} strokeLinecap="round" className="transition-all duration-500" />
    </svg>
  );
}

function DropdownPopover({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div ref={ref} className="absolute top-full end-0 mt-1 w-80 max-h-96 overflow-y-auto bg-card border border-border rounded-xl shadow-xl z-50">
      {children}
    </div>
  );
}

const NOTIF_TYPE_COLORS: Record<string, string> = {
  friend_request: 'bg-[#1877F2]',
  session: 'bg-[#42B72A]',
  assignment: 'bg-[#F7B928]',
  absence: 'bg-destructive',
  teacher: 'bg-[#1877F2]',
  general: 'bg-muted-foreground',
};

const NOTIF_TYPE_ICONS: Record<string, LucideIcon> = {
  friend_request: UsersRound,
  session: Flame,
  assignment: BookOpen,
  absence: Zap,
  teacher: Trophy,
  general: Bell,
};

export function BusuuNavBar({
  tabs,
  activeTab,
  onTabChange,
  streakDays = 0,
  progressPercent = 0,
  notificationCount = 0,
  courseLabel,
  languageFlag,
  pendingFriendRequests = 0,
  notifications = [],
  vocabCount = 0,
  completedLessons = 0,
  totalLessons = 0,
}: BusuuNavBarProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const closeAll = () => { setFriendsOpen(false); setNotifOpen(false); setStreakOpen(false); setCoursesOpen(false); };

  const handleFriendsClick = () => {
    setNotifOpen(false); setStreakOpen(false);
    if (pendingFriendRequests > 0) {
      setFriendsOpen(prev => !prev);
    } else {
      onTabChange('community');
    }
  };

  const handleNotifClick = () => {
    setFriendsOpen(false); setStreakOpen(false);
    setNotifOpen(prev => !prev);
  };

  const handleStreakClick = () => {
    setFriendsOpen(false); setNotifOpen(false);
    setStreakOpen(prev => !prev);
  };

  const handleMarkAllRead = () => {
    setDismissedIds(new Set(visibleNotifications.map(n => n.id)));
  };

  // Smart notifications
  const smartNotifications: NavNotification[] = (() => {
    if (notifications.length > 0) return [];
    const items: NavNotification[] = [];
    items.push({
      id: 'smart-welcome', type: 'general',
      titleKey: 'languages.dashboard.notifications.smartWelcome',
      descriptionKey: 'languages.dashboard.notifications.smartWelcomeDesc',
      read: true, actionTabId: 'overview',
    });
    if (progressPercent > 0 && progressPercent < 100) {
      items.push({
        id: 'smart-progress', type: 'teacher',
        titleKey: 'languages.dashboard.notifications.smartProgress',
        descriptionKey: 'languages.dashboard.notifications.smartProgressDesc',
        read: true, actionTabId: 'courses',
      });
    }
    if (streakDays > 0) {
      items.push({
        id: 'smart-streak', type: 'session',
        titleKey: 'languages.dashboard.notifications.smartStreak',
        descriptionKey: 'languages.dashboard.notifications.smartStreakDesc',
        read: true, actionTabId: 'progress',
      });
    }
    return items;
  })();

  const allNotifications = notifications.length > 0 ? notifications : smartNotifications;
  const visibleNotifications = allNotifications.filter(n => !dismissedIds.has(n.id));
  const unreadCount = notifications.length > 0
    ? visibleNotifications.filter(n => !n.read).length
    : 0;
  const displayCount = notificationCount > 0 ? notificationCount : unreadCount;

  return (
    <div className="w-full bg-white dark:bg-[#242526] border-b border-[#CED0D4] dark:border-[#3E4042] sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Top row: flag + right icons */}
        <div className="flex items-center justify-between h-12 sm:h-14">
          {/* Left: Course flag + Desktop tabs */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none flex-1 min-w-0">
            {/* Course flag with dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => { closeAll(); setCoursesOpen(prev => !prev); }}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors shrink-0",
                  coursesOpen
                    ? "bg-[#E7F3FF] dark:bg-[#263951]"
                    : "hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C]"
                )}
              >
                {languageFlag && <span className="text-lg sm:text-xl leading-none">{languageFlag}</span>}
                <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", coursesOpen && "rotate-180")} />
              </button>
              <DropdownPopover open={coursesOpen} onClose={() => setCoursesOpen(false)}>
                <div className="p-3">
                  <h3 className="text-sm font-bold text-foreground mb-3">{t('languages.dashboard.courseSwitcher.title')}</h3>
                  <button
                    onClick={() => setCoursesOpen(false)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-[#E7F3FF] dark:bg-[#263951] mb-1"
                  >
                    <span className="text-2xl">🇷🇺</span>
                    <div className="text-start">
                      <p className="text-sm font-semibold text-[#1877F2]">{t('languages.catalog.russian.name')}</p>
                      <p className="text-[10px] text-muted-foreground">{t('languages.dashboard.courseSwitcher.current')}</p>
                    </div>
                  </button>
                  <div className="border-t border-border my-2" />
                  <p className="text-xs text-muted-foreground mb-2">{t('languages.dashboard.courseSwitcher.browse')}</p>
                  <button
                    onClick={() => { setCoursesOpen(false); navigate('/languages'); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#F0F2F5] dark:bg-[#3A3B3C] flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="text-start">
                      <p className="text-sm font-medium text-foreground">{t('languages.dashboard.courseSwitcher.allCourses')}</p>
                      <p className="text-[10px] text-muted-foreground">{t('languages.dashboard.courseSwitcher.exploreMore')}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setCoursesOpen(false); navigate('/'); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#F0F2F5] dark:bg-[#3A3B3C] flex items-center justify-center">
                      <Home className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="text-start">
                      <p className="text-sm font-medium text-foreground">{t('languages.dashboard.courseSwitcher.home')}</p>
                      <p className="text-[10px] text-muted-foreground">{t('languages.dashboard.courseSwitcher.mainSite')}</p>
                    </div>
                  </button>
                </div>
              </DropdownPopover>
            </div>

            {/* Desktop tabs — hidden on mobile */}
            <div className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-none">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      "relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0",
                      isActive
                        ? "bg-[#E7F3FF] dark:bg-[#263951] text-[#1877F2] border-b-2 border-[#1877F2]"
                        : "text-[#65676B] dark:text-[#B0B3B8] hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t(tab.labelKey)}</span>
                    {(tab.badge ?? 0) > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-[#E41E3F] text-white">
                        {(tab.badge ?? 0) > 99 ? '99+' : tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Streak, Theme, Language, Friends, Notifications, Avatar */}
          <div className="flex items-center gap-1 shrink-0 ms-1">
            {/* Streak fire with popup */}
            <div className="relative">
              <button
                onClick={handleStreakClick}
                className={cn(
                  "relative p-1.5 rounded-full transition-colors",
                  streakOpen
                    ? "bg-[#FEF3C7] dark:bg-[#422006]"
                    : "bg-[#E4E6EB] dark:bg-[#3A3B3C] hover:bg-[#D8DADF] dark:hover:bg-[#4E4F50]"
                )}
                title={t('languages.dashboard.busuu.streak')}
              >
                <Flame className={cn("w-4 h-4", streakOpen ? "text-[#F59E0B]" : streakDays > 0 ? "text-[#F7B928]" : "text-muted-foreground")} />
                {streakDays > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-[#F59E0B] text-white text-[9px] font-bold flex items-center justify-center">
                    {streakDays}
                  </span>
                )}
              </button>
              <DropdownPopover open={streakOpen} onClose={() => setStreakOpen(false)}>
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
                      <Flame className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground">
                        {streakDays > 0
                          ? t('languages.dashboard.streak.activeDays', { count: streakDays })
                          : t('languages.dashboard.streak.noStreak')}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('languages.dashboard.streak.keepGoing')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-[#F0F2F5] dark:bg-[#3A3B3C] p-3 text-center">
                      <p className="text-lg font-bold text-[#1877F2]">{completedLessons}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t('languages.dashboard.streak.lessonsCompleted')}</p>
                    </div>
                    <div className="rounded-xl bg-[#F0F2F5] dark:bg-[#3A3B3C] p-3 text-center">
                      <p className="text-lg font-bold text-[#42B72A]">{vocabCount}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t('languages.dashboard.streak.wordsLearned')}</p>
                    </div>
                    <div className="rounded-xl bg-[#F0F2F5] dark:bg-[#3A3B3C] p-3 text-center">
                      <p className="text-lg font-bold text-[#F59E0B]">{progressPercent}%</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t('languages.dashboard.streak.progress')}</p>
                    </div>
                  </div>
                  {totalLessons > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{completedLessons}/{totalLessons}</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#E4E6EB] dark:bg-[#3A3B3C] overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#1877F2] to-[#42B72A] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </DropdownPopover>
            </div>

            {/* Dark/Light mode toggle — hidden on small mobile */}
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="hidden sm:block p-1.5 rounded-full bg-[#E4E6EB] dark:bg-[#3A3B3C] hover:bg-[#D8DADF] dark:hover:bg-[#4E4F50] transition-colors"
              title={t('languages.dashboard.theme.toggle')}
            >
              {resolvedTheme === 'dark'
                ? <Sun className="w-4 h-4 text-[#F7B928]" />
                : <Moon className="w-4 h-4 text-foreground" />}
            </button>

            {/* Language switcher — hidden on small mobile */}
            <div className="hidden sm:block [&_button]:p-1.5 [&_button]:rounded-full [&_button]:bg-[#E4E6EB] [&_button]:dark:bg-[#3A3B3C] [&_button]:hover:bg-[#D8DADF] [&_button]:dark:hover:bg-[#4E4F50] [&_button]:h-auto [&_button]:gap-0.5 [&_button]:text-xs">
              <LanguageToggle />
            </div>

            {/* Friends button */}
            <div className="relative">
              <button
                onClick={handleFriendsClick}
                className={cn(
                  "relative p-1.5 rounded-full transition-colors",
                  friendsOpen
                    ? "bg-[#E7F3FF] dark:bg-[#263951]"
                    : "bg-[#E4E6EB] dark:bg-[#3A3B3C] hover:bg-[#D8DADF] dark:hover:bg-[#4E4F50]"
                )}
                title={t('languages.dashboard.community.title')}
              >
                <UsersRound className={cn("w-4 h-4", friendsOpen ? "text-[#1877F2]" : "text-foreground")} />
                {pendingFriendRequests > 0 && (
                   <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-[#E41E3F] text-white text-[9px] font-bold flex items-center justify-center">
                    {pendingFriendRequests > 99 ? '99+' : pendingFriendRequests}
                  </span>
                )}
              </button>
              <DropdownPopover open={friendsOpen} onClose={() => setFriendsOpen(false)}>
                <div className="p-3">
                  <h3 className="text-base font-bold text-foreground mb-2">{t('languages.dashboard.community.friendRequests')}</h3>
                  {pendingFriendRequests > 0 ? (
                    <button
                      onClick={() => { setFriendsOpen(false); onTabChange('community'); }}
                      className="w-full text-start p-3 rounded-lg hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C] transition-colors"
                    >
                      <p className="text-sm font-medium text-[#1877F2]">
                        {t('languages.dashboard.notifications.viewFriendRequests', { count: pendingFriendRequests })}
                      </p>
                    </button>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">{t('languages.dashboard.notifications.noFriendRequests')}</p>
                  )}
                </div>
              </DropdownPopover>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={handleNotifClick}
                className={cn(
                  "relative p-1.5 rounded-full transition-colors",
                  notifOpen
                    ? "bg-[#E7F3FF] dark:bg-[#263951]"
                    : "bg-[#E4E6EB] dark:bg-[#3A3B3C] hover:bg-[#D8DADF] dark:hover:bg-[#4E4F50]"
                )}
              >
                <Bell className={cn("w-4 h-4", notifOpen ? "text-[#1877F2]" : "text-foreground")} />
                {displayCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-[#E41E3F] text-white text-[9px] font-bold flex items-center justify-center">
                    {displayCount > 99 ? '99+' : displayCount}
                  </span>
                )}
              </button>
              <DropdownPopover open={notifOpen} onClose={() => setNotifOpen(false)}>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-foreground">{t('languages.dashboard.notifications.title')}</h3>
                    {visibleNotifications.length > 0 && notifications.length > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-[#1877F2] hover:underline flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5" />
                        {t('languages.dashboard.notifications.markAllRead')}
                      </button>
                    )}
                  </div>
                  {visibleNotifications.length === 0 ? (
                    <div className="py-8 flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#F0F2F5] dark:bg-[#3A3B3C] flex items-center justify-center">
                        <BellOff className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">{t('languages.dashboard.notifications.empty')}</p>
                      <p className="text-xs text-muted-foreground text-center max-w-[200px]">{t('languages.dashboard.notifications.emptyHint')}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {visibleNotifications.map(n => {
                        const NotifIcon = NOTIF_TYPE_ICONS[n.type] || Bell;
                        return (
                          <button
                            key={n.id}
                            onClick={() => { setNotifOpen(false); if (n.actionTabId) onTabChange(n.actionTabId); }}
                            className={cn(
                              "w-full text-start p-2.5 rounded-lg transition-colors flex items-start gap-3",
                              n.read ? "hover:bg-[#F0F2F5] dark:hover:bg-[#3A3B3C]" : "bg-[#E7F3FF] dark:bg-[#263951] hover:bg-[#DBEAFE] dark:hover:bg-[#2a4060]"
                            )}
                          >
                            <div className={cn("mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0", NOTIF_TYPE_COLORS[n.type] || 'bg-muted')}>
                              <NotifIcon className="w-4 h-4 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">{t(n.titleKey)}</p>
                              {n.descriptionKey && <p className="text-xs text-muted-foreground mt-0.5">{t(n.descriptionKey)}</p>}
                              {n.timestamp && <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.timestamp).toLocaleString()}</p>}
                            </div>
                            {!n.read && <span className="mt-2 w-2 h-2 rounded-full bg-[#1877F2] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </DropdownPopover>
            </div>


            {/* Original site avatar with full dropdown menu */}
            <HeaderAuth />
          </div>
        </div>

        {/* Mobile tab bar — second row, only on small screens */}
        <div className="flex md:hidden items-center gap-0.5 overflow-x-auto scrollbar-none pb-1.5 -mx-1 px-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap shrink-0",
                  isActive
                    ? "bg-[#E7F3FF] dark:bg-[#263951] text-[#1877F2]"
                    : "text-[#65676B] dark:text-[#B0B3B8]"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t(tab.labelKey)}</span>
                {(tab.badge ?? 0) > 0 && (
                  <span className="min-w-[16px] h-[16px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center bg-[#E41E3F] text-white">
                    {(tab.badge ?? 0) > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
