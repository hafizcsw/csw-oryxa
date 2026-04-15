/**
 * Admin Institution View
 * Wraps the Institution Dashboard in super-admin mode.
 * Route: /admin/institutions/:id
 * 
 * Data source: CRM adapter (institutionCrmAdapter) — NOT direct portal tables.
 * Preview context used as secondary rendering aid only.
 */
import { useParams, Outlet } from 'react-router-dom';
import { useAdminInstitution } from '@/hooks/useAdminInstitution';
import { AdminInstitutionToolbar } from '@/components/institution/AdminInstitutionToolbar';
import { InstitutionDashboardShell } from '@/components/institution/InstitutionDashboardShell';
import { PageLoader } from '@/components/ui/PageLoader';
import { Building2, AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function AdminInstitutionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    loading,
    institution,
    error,
    realAccessState,
    previewAccessState,
    switchPreviewState,
  } = useAdminInstitution(id);

  if (loading) return <PageLoader />;

  // No institution record found — show clear empty state (NOT a university fallback)
  if (!institution) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">No Institution Record</h2>
        <p className="text-muted-foreground mb-6">
          {error
            ? `Error loading institution: ${error}`
            : 'This entity has no active institution record or claim. It may be a public university entry without an institution portal account.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => navigate('/admin/institutions')}>
            Back to Hub
          </Button>
          <Button variant="default" disabled className="gap-1">
            <Plus className="w-4 h-4" />
            Create Institution Record
          </Button>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Institution records are managed through the CRM. Direct university entries are not institution accounts.</span>
        </div>
      </div>
    );
  }

  const basePath = `/admin/institutions/${id}`;

  return (
    <div className="min-h-screen bg-background">
      <AdminInstitutionToolbar
        institutionId={institution.institutionId || institution.id}
        institutionName={institution.institutionName}
        realAccessState={realAccessState!}
        previewAccessState={previewAccessState!}
        claimStatus={institution.claimStatus}
        onPreviewStateChange={switchPreviewState}
      />
      <InstitutionDashboardShell basePath={basePath} adminMode>
        <Outlet />
      </InstitutionDashboardShell>
    </div>
  );
}
