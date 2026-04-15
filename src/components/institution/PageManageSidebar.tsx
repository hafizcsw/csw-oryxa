/**
 * Facebook-style "Manage Page" left sidebar for page operators.
 * Role-aware: only shows tabs the current staff role has access to.
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText, Users, Inbox, Settings, ShieldAlert, BarChart3,
  History, ClipboardCheck, ChevronDown, ChevronUp, Building2, Home, GraduationCap, Award, ShieldCheck, ClipboardList, Upload
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';

export type OperatorTab = 'dashboard' | 'posts' | 'programs' | 'scholarships' | 'governed' | 'staff' | 'inbox' | 'intake' | 'moderation' | 'analytics' | 'activity' | 'review' | 'settings' | 'ingestion' | null;

/** Maps each tab to the backend roles that can access it */
const TAB_PERMISSIONS: Record<Exclude<OperatorTab, null>, string[]> = {
  dashboard: ['full_control', 'page_admin', 'content_publisher', 'moderator', 'inbox_agent', 'analyst', 'live_community_manager'],
  posts: ['full_control', 'page_admin', 'content_publisher'],
  programs: ['full_control', 'page_admin'],
  scholarships: ['full_control', 'page_admin'],
  governed: ['full_control', 'page_admin'],
  intake: ['full_control', 'page_admin', 'inbox_agent'],
  inbox: ['full_control', 'page_admin', 'inbox_agent'],
  analytics: ['full_control', 'page_admin', 'analyst'],
  settings: ['full_control', 'page_admin'],
  staff: ['full_control', 'page_admin'],
  moderation: ['full_control', 'page_admin', 'moderator'],
  activity: ['full_control', 'page_admin'],
  review: ['full_control', 'page_admin'],
  ingestion: ['full_control', 'page_admin'],
};

interface PageManageSidebarProps {
  uniName: string;
  logoUrl?: string | null;
  activeTab: OperatorTab;
  onTabChange: (tab: OperatorTab) => void;
  staffRole?: string | null;
  isSuperAdmin?: boolean;
}

const MAIN_ITEMS: { key: OperatorTab; icon: typeof FileText; labelKey: string }[] = [
  { key: 'dashboard', icon: Home, labelKey: 'pageOS.dashboard.title' },
  { key: 'posts', icon: FileText, labelKey: 'pageOS.toolbar.posts' },
  { key: 'programs', icon: GraduationCap, labelKey: 'pageOS.toolbar.programs' },
  { key: 'scholarships', icon: Award, labelKey: 'pageOS.toolbar.scholarships' },
  { key: 'intake', icon: ClipboardList, labelKey: 'intake.workspace.title' },
  { key: 'inbox', icon: Inbox, labelKey: 'pageOS.toolbar.inbox' },
  { key: 'analytics', icon: BarChart3, labelKey: 'pageOS.toolbar.analytics' },
  { key: 'settings', icon: Settings, labelKey: 'pageOS.toolbar.settings' },
];

const MORE_ITEMS: { key: OperatorTab; icon: typeof FileText; labelKey: string }[] = [
  { key: 'governed', icon: ShieldCheck, labelKey: 'pageOS.governed.title' },
  { key: 'ingestion', icon: Upload, labelKey: 'ingestion.title' },
  { key: 'staff', icon: Users, labelKey: 'pageOS.toolbar.staff' },
  { key: 'moderation', icon: ShieldAlert, labelKey: 'pageOS.toolbar.moderation' },
  { key: 'activity', icon: History, labelKey: 'pageOS.toolbar.activity' },
  { key: 'review', icon: ClipboardCheck, labelKey: 'pageOS.toolbar.review' },
];

function canAccessTab(tab: Exclude<OperatorTab, null>, role: string | null | undefined, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  if (!role) return false;
  return TAB_PERMISSIONS[tab]?.includes(role) ?? false;
}

export function PageManageSidebar({ uniName, logoUrl, activeTab, onTabChange, staffRole, isSuperAdmin = false }: PageManageSidebarProps) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleMain = useMemo(
    () => MAIN_ITEMS.filter(i => canAccessTab(i.key as Exclude<OperatorTab, null>, staffRole, isSuperAdmin)),
    [staffRole, isSuperAdmin]
  );

  const visibleMore = useMemo(
    () => MORE_ITEMS.filter(i => canAccessTab(i.key as Exclude<OperatorTab, null>, staffRole, isSuperAdmin)),
    [staffRole, isSuperAdmin]
  );

  const moreActive = visibleMore.some(i => i.key === activeTab);

  return (
    <aside className="fb-manage-sidebar">
      {/* Header */}
      <div className="fb-manage-sidebar__header">
        <h3 className="fb-manage-sidebar__title">{t('institution.toolbar.managing')}</h3>
      </div>

      {/* Page identity */}
      <button className="fb-manage-sidebar__page-id" onClick={() => onTabChange(null)}>
        <Avatar className="h-9 w-9 border">
          {logoUrl ? (
            <img src={logoUrl} alt={uniName} className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          )}
        </Avatar>
        <span className="fb-manage-sidebar__page-name">{uniName}</span>
      </button>

      {/* Main nav */}
      <nav className="fb-manage-sidebar__nav">
        {visibleMain.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              className={`fb-manage-sidebar__item ${isActive ? 'fb-manage-sidebar__item--active' : ''}`}
              onClick={() => onTabChange(isActive ? null : item.key)}
            >
              <Icon className="h-5 w-5" />
              <span>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      {/* More tools — only if any are visible */}
      {visibleMore.length > 0 && (
        <div className="fb-manage-sidebar__more">
          <button
            className="fb-manage-sidebar__more-toggle"
            onClick={() => setMoreOpen(o => !o)}
          >
            <span className="fb-manage-sidebar__more-label">
              {t('pageOS.sidebar.moreTools')}
            </span>
            {(moreOpen || moreActive) ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {(moreOpen || moreActive) && (
            <nav className="fb-manage-sidebar__nav fb-manage-sidebar__nav--sub">
              {visibleMore.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    className={`fb-manage-sidebar__item ${isActive ? 'fb-manage-sidebar__item--active' : ''}`}
                    onClick={() => onTabChange(isActive ? null : item.key)}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{t(item.labelKey)}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      )}
    </aside>
  );
}
