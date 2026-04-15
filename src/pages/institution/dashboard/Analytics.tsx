/**
 * Institution Dashboard - Analytics (Limited)
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart3 } from 'lucide-react';

export default function InstitutionAnalytics() {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{t('institution.nav.analytics')}</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {['pageViews', 'inquiries', 'applicationsReceived'].map(metric => (
          <div key={metric} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">{t(`institution.analytics.${metric}`)}</p>
            <p className="text-2xl font-bold text-foreground">—</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{t('institution.analytics.limited')}</p>
      </div>
    </div>
  );
}
