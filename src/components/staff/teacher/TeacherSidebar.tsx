/**
 * TeacherSidebar — Zoom-inspired clean sidebar navigation.
 * Minimal, professional, icon-focused when collapsed.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, CalendarDays, UserCircle, Settings,
  ChevronLeft, ChevronRight, Menu, X, MessageCircle, Bot, ClipboardList
} from 'lucide-react';
import { useState } from 'react';

interface TeacherSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  studentCount: number;
  sessionCount: number;
  unreadMessages?: number;
  teacherName?: string;
  teacherEmail?: string;
  teacherAvatarUrl?: string;
  role?: string;
}

export function TeacherSidebar({
  activeView, onNavigate, studentCount, sessionCount, unreadMessages,
  teacherName, teacherEmail, teacherAvatarUrl, role
}: TeacherSidebarProps) {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    {
      id: 'home',
      icon: LayoutDashboard,
      label: t('staff.teacher.sidebar.home', { defaultValue: 'Home' }),
      badge: null,
    },
    {
      id: 'students',
      icon: Users,
      label: t('staff.teacher.sidebar.students', { defaultValue: 'Students' }),
      badge: studentCount > 0 ? studentCount : null,
    },
    {
      id: 'sessions',
      icon: CalendarDays,
      label: t('staff.teacher.sidebar.sessions', { defaultValue: 'Sessions' }),
      badge: sessionCount > 0 ? sessionCount : null,
    },
    {
      id: 'messages',
      icon: MessageCircle,
      label: t('staff.teacher.sidebar.messages', { defaultValue: 'Messages' }),
      badge: (unreadMessages && unreadMessages > 0) ? unreadMessages : null,
    },
    {
      id: 'plans',
      icon: ClipboardList,
      label: t('staff.teacher.sidebar.plans', { defaultValue: 'Plans' }),
      badge: null,
    },
    {
      id: 'copilot',
      icon: Bot,
      label: t('staff.teacher.sidebar.copilot', { defaultValue: 'AI Copilot' }),
      badge: null,
    },
    {
      id: 'profile',
      icon: UserCircle,
      label: t('staff.teacher.sidebar.my_profile', { defaultValue: 'My Profile' }),
      badge: null,
    },
    {
      id: 'settings',
      icon: Settings,
      label: t('staff.teacher.sidebar.settings', { defaultValue: 'Settings' }),
      badge: null,
    },
  ];

  const sidebarContent = (
    <>
      {/* Profile header */}
      <div className={cn("px-3 pt-4 pb-3", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <Avatar className="w-8 h-8 shrink-0 ring-2 ring-border">
            <AvatarImage src={teacherAvatarUrl} alt={teacherName || ''} className="object-cover" />
            <AvatarFallback className="bg-[#0E71EB]/10 text-[#0E71EB] text-xs font-bold">
              {(teacherName || 'T').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold truncate text-foreground">
                {teacherName || t('staff.teacher.sidebar.teacher', { defaultValue: 'Teacher' })}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {teacherEmail || ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border mx-3" />

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
              title={collapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-[#0E71EB]/10 text-[#0E71EB] font-medium"
                  : "text-foreground/60 hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-[#0E71EB]")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && item.badge !== null && (
                <span className={cn(
                  "ms-auto text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1",
                  item.id === 'messages' && item.badge
                    ? "bg-[#E02828] text-white"
                    : "bg-muted text-muted-foreground"
                )}>
                  {item.badge}
                </span>
              )}
              {collapsed && item.badge !== null && item.badge > 0 && (
                <span className="absolute top-0.5 end-0.5 w-2 h-2 rounded-full bg-[#E02828]" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden fixed bottom-4 start-4 z-40 h-10 w-10 rounded-full bg-[#0E71EB] text-white shadow-lg hover:bg-[#0E71EB]/90"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        "lg:hidden fixed inset-y-0 start-0 z-30 w-60 bg-card border-e border-border flex flex-col transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
      )}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col border-e border-border bg-card shrink-0 transition-all duration-200",
        collapsed ? "w-14" : "w-56"
      )}>
        <div className="flex items-center justify-end px-2 pt-2">
          <button
            className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
}
