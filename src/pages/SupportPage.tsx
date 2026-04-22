import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/layout/Layout';
import { SupportInbox } from '@/features/support/SupportInbox';
import { IdentityCaseCard } from '@/features/identity/IdentityCaseCard';

export default function SupportPage() {
  const { t } = useTranslation();
  const title = t('support.page.title', { defaultValue: 'Support' });
  useEffect(() => { document.title = title; }, [title]);

  return (
    <Layout>
      <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('support.page.subtitle', { defaultValue: 'Conversations with your counselor and identity status.' })}
          </p>
        </header>
        <IdentityCaseCard />
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">
            {t('support.inbox.title', { defaultValue: 'Your support cases' })}
          </h2>
          <SupportInbox />
        </section>
      </div>
    </Layout>
  );
}
