import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/layout/Layout';
import { Helmet } from 'react-helmet';
import { UnifiedTranslationOrder } from '@/components/translation/UnifiedTranslationOrder';

export default function TranslationNewOrderPage() {
  const { t } = useTranslation('translation');

  return (
    <Layout>
      <Helmet>
        <title>{t('unified.title')} | CSW</title>
      </Helmet>
      <UnifiedTranslationOrder />
    </Layout>
  );
}
