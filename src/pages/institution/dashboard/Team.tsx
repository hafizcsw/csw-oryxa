/**
 * Institution Dashboard - Team Management
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { Users, Plus, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InstitutionTeam() {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('institution.nav.team')}</h2>
        <Button size="sm" className="gap-2 rounded-xl">
          <Plus className="w-4 h-4" /> {t('institution.team.invite')}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{t('institution.team.empty')}</p>
      </div>
    </div>
  );
}
