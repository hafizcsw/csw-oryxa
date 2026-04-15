/**
 * Institution Dashboard Shell (reusable)
 * The sidebar navigation + content area, reused by both:
 *  - /institution/dashboard (institution mode)
 *  - /admin/institutions/:id (super-admin mode)
 * 
 * basePath: determines the navigation links
 * adminMode: shows admin-specific UI elements
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useInstitutionAccess } from '@/hooks/useInstitutionAccess';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FileText, Globe, GraduationCap,
  Users, Paperclip, BarChart3, Settings, Lock, CheckCircle2, Building2
} from 'lucide-react';

interface NavItem {
  id: string;
  labelKey: string;
  icon: React.ElementType;
  pathSuffix: string;
  module?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', labelKey: 'institution.nav.overview', icon: LayoutDashboard, pathSuffix: '' },
  { id: 'applications', labelKey: 'institution.nav.applications', icon: FileText, pathSuffix: '/applications', module: 'applications' },
  { id: 'page', labelKey: 'institution.nav.page', icon: Globe, pathSuffix: '/page', module: 'page' },
  { id: 'programs', labelKey: 'institution.nav.programs', icon: GraduationCap, pathSuffix: '/programs', module: 'programs' },
  { id: 'team', labelKey: 'institution.nav.team', icon: Users, pathSuffix: '/team', module: 'team' },
  { id: 'documents', labelKey: 'institution.nav.documents', icon: Paperclip, pathSuffix: '/documents', module: 'documents' },
  { id: 'analytics', labelKey: 'institution.nav.analytics', icon: BarChart3, pathSuffix: '/analytics', module: 'analytics' },
  { id: 'settings', labelKey: 'institution.nav.settings', icon: Settings, pathSuffix: '/settings', module: 'settings' },
];

interface InstitutionDashboardShellProps {
  basePath: string;
  adminMode?: boolean;
  children: React.ReactNode;
}

export function InstitutionDashboardShell({ basePath, adminMode, children }: InstitutionDashboardShellProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { institutionName, accessState, isModuleAllowed } = useInstitutionAccess();

  const getItemPath = (item: NavItem) => basePath + item.pathSuffix;

  const activeId = NAV_ITEMS.find(item => {
    const itemPath = getItemPath(item);
    return itemPath === location.pathname ||
      (item.id !== 'overview' && location.pathname.startsWith(itemPath));
  })?.id || 'overview';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">
            {institutionName || t('institution.dashboard.title')}
          </h1>
          <div className="flex items-center gap-2">
            {accessState === 'verified' && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" /> {t('institution.verified')}
              </span>
            )}
            {accessState === 'restricted' && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Lock className="w-3 h-3" /> {t('institution.restricted')}
              </span>
            )}
            {adminMode && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                Super Admin Mode
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 shrink-0 hidden md:block">
          <nav className="bg-card rounded-2xl border border-border p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;
              const isLocked = !adminMode && item.module && !isModuleAllowed(item.module);
              const itemPath = getItemPath(item);

              return (
                <button
                  key={item.id}
                  onClick={() => !isLocked && navigate(itemPath)}
                  disabled={!!isLocked}
                  className={cn(
                    'w-full flex items-center gap-3 p-2.5 rounded-xl text-sm font-medium transition-all text-right',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : isLocked
                        ? 'text-muted-foreground/50 cursor-not-allowed'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1">{t(item.labelKey)}</span>
                  {isLocked && <Lock className="w-3 h-3" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden w-full mb-4">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;
              const isLocked = !adminMode && item.module && !isModuleAllowed(item.module);
              const itemPath = getItemPath(item);
              return (
                <button
                  key={item.id}
                  onClick={() => !isLocked && navigate(itemPath)}
                  disabled={!!isLocked}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
