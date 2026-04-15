/**
 * Full-page unified messaging surface.
 * Context-aware: staff sees university comm workspace, student sees unified inbox.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/layout/Layout';
import { PageOperatorShell } from '@/components/institution/PageOperatorShell';
import { SEOHead } from '@/components/seo/SEOHead';
import { useStaffUniversityId } from '@/hooks/useStaffUniversityId';
import { StudentInbox } from '@/components/comm/StudentInbox';
import { UniversityCommWorkspace } from '@/components/comm/UniversityCommWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function MessagesPage() {
  const { t } = useTranslation();
  const { staffUniId, loading: staffLoading } = useStaffUniversityId();
  const isStaff = !!staffUniId;
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  if (staffLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (isStaff && staffUniId) {
    return (
      <PageOperatorShell universityName="" logoUrl="">
        <SEOHead title={t('comm.pageTitle')} description="" index={false} />
        <div className="max-w-6xl mx-auto" style={{ height: 'calc(100vh - 56px)' }}>
          <UniversityCommWorkspace universityId={staffUniId} currentUserId={userId || undefined} />
        </div>
      </PageOperatorShell>
    );
  }

  return (
    <Layout>
      <SEOHead title={t('comm.pageTitle')} description="" index={false} />
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-3" style={{ height: 'calc(100vh - 72px)' }}>
        <StudentInbox />
      </div>
    </Layout>
  );
}
