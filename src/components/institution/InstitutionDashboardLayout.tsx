/**
 * Institution Dashboard Layout
 * Shell with sidebar navigation for verified institutions
 * Reuses InstitutionDashboardShell for consistent UI
 */
import { Outlet } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { InstitutionPreviewBanner } from '@/components/institution/InstitutionPreviewBanner';
import { InstitutionDashboardShell } from '@/components/institution/InstitutionDashboardShell';

export function InstitutionDashboardLayout() {
  return (
    <Layout>
      <InstitutionPreviewBanner />
      <InstitutionDashboardShell basePath="/institution/dashboard">
        <Outlet />
      </InstitutionDashboardShell>
    </Layout>
  );
}
