/**
 * Institution Dashboard - Documents
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { Paperclip, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InstitutionDocuments() {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('institution.nav.documents')}</h2>
        <Button size="sm" className="gap-2 rounded-xl">
          <Upload className="w-4 h-4" /> {t('institution.documents.upload')}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <Paperclip className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{t('institution.documents.empty')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('institution.documents.types')}</p>
      </div>
    </div>
  );
}
