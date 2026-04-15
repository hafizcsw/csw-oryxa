/**
 * Institution Locked Page
 * Shown when institution account is suspended
 */
import { Layout } from '@/components/layout/Layout';
import { InstitutionPreviewBanner } from '@/components/institution/InstitutionPreviewBanner';
import { useLanguage } from '@/contexts/LanguageContext';
import { ShieldAlert, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InstitutionLocked() {
  const { t } = useLanguage();

  return (
    <Layout>
      <InstitutionPreviewBanner />
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {t('institution.locked.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('institution.locked.description')}
        </p>
        <Button variant="outline" className="gap-2">
          <Mail className="w-4 h-4" />
          {t('institution.locked.contactSupport')}
        </Button>
      </div>
    </Layout>
  );
}
