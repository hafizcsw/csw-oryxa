import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Inbox,
  School,
  Award,
  Calendar,
  Flag,
  Video,
  FileUp,
  ShieldCheck,
  Bot,
  Key,
  Send,
  Activity,
  FileText,
  Gauge,
  HeartPulse,
  ToggleLeft,
  Users,
  Settings,
  Search,
  Database,
  Home,
  ArrowRight,
  X,
  Trophy,
  FlaskConical,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";

const iconMap: Record<string, any> = {
  "layout-dashboard": LayoutDashboard,
  "inbox": Inbox,
  "school": School,
  "award": Award,
  "calendar": Calendar,
  "flag": Flag,
  "video": Video,
  "file-up": FileUp,
  "shield-check": ShieldCheck,
  "bot": Bot,
  "key": Key,
  "send": Send,
  "activity": Activity,
  "file-text": FileText,
  "gauge": Gauge,
  "heart-pulse": HeartPulse,
  "toggle-left": ToggleLeft,
  "users": Users,
  "settings": Settings,
  "search": Search,
  "database": Database,
  "home": Home,
  "monitor": LayoutDashboard,
  "trophy": Trophy,
  "flask": FlaskConical,
  "graduation-cap": GraduationCap,
};

interface AdminSidebarProps {
  onClose?: () => void;
}

export function AdminSidebar({ onClose }: AdminSidebarProps) {
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  const languageEnrollmentsLabel = isRTL ? "طلبات كورسات اللغات" : "Language Enrollments";
  const location = useLocation();
  const currentPath = location.pathname;

  const groups = [
    {
      title: t('admin.sidebar.overview'),
      items: [
        { label: t('admin.dashboard'), href: "/admin", icon: "layout-dashboard" },
      ]
    },
    {
      title: t('admin.sidebar.operations'),
      items: [
        { label: t('admin.sidebar.universities'), href: "/admin/universities-admin", icon: "school" },
        { label: t('admin.sidebar.scholarships'), href: "/admin/scholarships-admin", icon: "award" },
        { label: t('admin.sidebar.events'), href: "/admin/events-admin", icon: "calendar" },
        { label: languageEnrollmentsLabel, href: "/admin/language-enrollments", icon: "graduation-cap" },
        { label: "Language Enrollments", href: "/admin/language-enrollments", icon: "graduation-cap" },
      ]
    },
    {
      title: t('admin.sidebar.catalog'),
      items: [
        { label: t('admin.sidebar.countries'), href: "/admin/countries", icon: "flag" },
        { label: t('admin.sidebar.newsTicker'), href: "/admin/news-ticker", icon: "monitor" },
        { label: "Hero Video (2K)", href: "/admin/hero-video", icon: "video" },
        { label: t('admin.sidebar.videoTest'), href: "/admin/testimonials", icon: "video" },
        { label: t('admin.sidebar.universityRanking'), href: "/admin/unis-assistant", icon: "trophy" },
        { label: t('admin.sidebar.websiteEnrichment'), href: "/admin/website-enrichment", icon: "search" },
        { label: "ORX Control Panel", href: "/admin/orx-control", icon: "radar" },
      ]
    },
    {
      title: t('admin.sidebar.integrations'),
      items: [
        { label: t('admin.crmKeys'), href: "/admin/integrations/crm", icon: "key" },
      ]
    },
    {
      title: t('admin.sidebar.analytics'),
      items: [
        { label: t('admin.sidebar.seoOptimize'), href: "/admin/seo-ops", icon: "search" },
        { label: t('admin.sidebar.experiments'), href: "/admin/seo-ops/experiments", icon: "flask" },
        { label: t('admin.sidebar.dataQuality'), href: "/admin/data-quality", icon: "shield-check" },
        { label: t('admin.sidebar.featureFlags'), href: "/admin/feature-flags", icon: "flag" },
        { label: t('admin.sidebar.telemetry'), href: "/admin/telemetry", icon: "activity" },
        { label: t('admin.sidebar.systemHealth'), href: "/admin/health", icon: "heart-pulse" },
      ]
    },
    {
      title: t('admin.sidebar.configuration'),
      items: [
        { label: t('admin.sidebar.usersRoles'), href: "/admin/users", icon: "users" },
        { label: t('admin.sidebar.settings'), href: "/admin/settings", icon: "settings" },
      ]
    },
  ];

  const isActive = (path: string) => {
    if (path === "/admin") {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  };

  return (
    <aside className={`w-64 min-w-[16rem] bg-card shadow-lg flex-shrink-0 h-full flex flex-col ${isRTL ? 'border-l border-border' : 'border-r border-border'}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="p-2">
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={`lg:hidden absolute top-2 text-muted-foreground hover:text-foreground ${isRTL ? 'left-2' : 'right-2'}`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <div className="px-1 py-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <LayoutDashboard className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Material Admin</h2>
              <p className="text-[10px] text-muted-foreground">{t('admin.sidebar.adminSystem')}</p>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <div className="p-2 space-y-1.5">
          {groups.map((group, groupIndex) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-2">
                {group.title}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = iconMap[item.icon];
                  const active = isActive(item.href);
                  
                  return (
                    <li key={item.href}>
                      <NavLink
                        to={item.href}
                        className={`flex items-center justify-between gap-2 px-2 h-8 rounded-lg text-xs font-medium transition-colors duration-200 ${
                          active
                            ? `bg-primary/10 text-primary ${isRTL ? 'border-r-[3px] border-primary' : 'border-l-[3px] border-primary'}`
                            : "text-foreground/70 hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        {Icon && (
                          <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${
                            active ? "text-primary" : "text-muted-foreground"
                          }`} />
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
              {groupIndex < groups.length - 1 && (
                <Separator className="mt-1.5" />
              )}
            </div>
        ))}
      </div>
    </aside>
  );
}
