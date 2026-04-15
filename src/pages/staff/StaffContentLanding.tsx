/**
 * Staff Landing Page — Placeholder for content_staff role.
 */
import { useStaffAuthority } from '@/hooks/useStaffAuthority';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageLoader } from '@/components/ui/PageLoader';
import { Navigate } from 'react-router-dom';

export default function StaffContentLanding() {
  const { isStaff, role, loading } = useStaffAuthority();
  const { t } = useLanguage();

  if (loading) return <PageLoader />;
  if (!isStaff) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📝</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t('staff.content.landing.title', { defaultValue: 'Content Portal' })}
        </h1>
        <p className="text-muted-foreground">
          {t('staff.content.landing.description', { defaultValue: 'Your content dashboard is being prepared.' })}
        </p>
        <div className="mt-4 px-3 py-1.5 rounded-full bg-secondary/20 text-secondary-foreground text-sm font-medium inline-block">
          {role}
        </div>
      </div>
    </div>
  );
}
