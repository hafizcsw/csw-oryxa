import { useParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { SupportThread } from '@/features/support/SupportThread';

export default function SupportCasePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useTranslation();
  if (!caseId) return <Navigate to="/portal/support" replace />;

  return (
    <Layout>
      <Helmet>
        <title>{t('support.thread.title', { defaultValue: 'Support case' })}</title>
      </Helmet>
      <div className="container max-w-3xl mx-auto px-4 py-6">
        <SupportThread caseId={caseId} />
      </div>
    </Layout>
  );
}
