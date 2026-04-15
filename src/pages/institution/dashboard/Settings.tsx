/**
 * Institution Dashboard - Settings
 * Status: Placeholder — full settings management coming soon.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { Settings as SettingsIcon, Bell, Shield, Construction } from 'lucide-react';

export default function InstitutionSettings() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">{t('institution.nav.settings')}</h2>

      {/* Coming Soon Notice */}
      <div className="rounded-2xl border border-border bg-muted/30 p-8 flex flex-col items-center justify-center text-center gap-4">
        <div className="p-4 rounded-full bg-primary/10">
          <Construction className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {t('institution.settings.comingSoonTitle')}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('institution.settings.comingSoonDesc')}
        </p>
      </div>
    </div>
  );
}
