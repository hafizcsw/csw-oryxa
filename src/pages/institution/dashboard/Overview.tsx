/**
 * Institution Dashboard - Overview Tab
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { useInstitutionAccess } from '@/hooks/useInstitutionAccess';
import { LayoutDashboard, FileText, Eye, TrendingUp, Bell, Lock } from 'lucide-react';
import { ReadinessPipeline } from '@/components/readiness/ReadinessPipeline';

export default function InstitutionOverview() {
  const { t } = useLanguage();
  const { institutionName, accessState, isModuleAllowed } = useInstitutionAccess();

  const cards = [
    { labelKey: 'institution.overview.pendingApplications', value: '—', icon: FileText, module: 'applications' },
    { labelKey: 'institution.overview.pageViews', value: '—', icon: Eye, module: 'analytics' },
    { labelKey: 'institution.overview.inquiries', value: '—', icon: TrendingUp, module: 'analytics' },
    { labelKey: 'institution.overview.pendingActions', value: '—', icon: Bell, module: null },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          const locked = card.module && !isModuleAllowed(card.module);
          return (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 relative">
              {locked && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <Icon className="w-5 h-5 text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground">{t(card.labelKey)}</p>
            </div>
          );
        })}
      </div>

      {/* Readiness Pipeline */}
      <ReadinessPipeline />

      {/* Recent Activity */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold mb-4">{t('institution.overview.recentActivity')}</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          {t('institution.overview.noActivity')}
        </p>
      </div>

      {/* Verification Badge */}
      {accessState === 'restricted' && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-700 dark:text-amber-300">
          {t('institution.overview.restrictedNotice')}
        </div>
      )}
    </div>
  );
}
