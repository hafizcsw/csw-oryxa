/**
 * Institution Dashboard - Institution Page Editor (Change-set model)
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { Globe, Eye, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InstitutionPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('institution.nav.page')}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 rounded-xl">
            <Eye className="w-4 h-4" /> {t('institution.page.preview')}
          </Button>
          <Button size="sm" className="gap-2 rounded-xl">
            <Send className="w-4 h-4" /> {t('institution.page.submitChanges')}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{t('institution.page.editDraft')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('institution.page.noDirectPublish')}</p>
      </div>
    </div>
  );
}
