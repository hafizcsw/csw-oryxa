/**
 * Staff Landing Page — Placeholder for teacher role.
 */
import { useStaffAuthority } from '@/hooks/useStaffAuthority';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageLoader } from '@/components/ui/PageLoader';
import { Navigate } from 'react-router-dom';

export default function StaffTeacherLanding() {
  const { isStaff, role, loading } = useStaffAuthority();
  const { t } = useLanguage();

  if (loading) return <PageLoader />;
  if (!isStaff) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">👩‍🏫</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t('staff.teacher.landing.title', { defaultValue: 'Teacher Portal' })}
        </h1>
        <p className="text-muted-foreground">
          {t('staff.teacher.landing.description', { defaultValue: 'Your teacher dashboard is being prepared.' })}
        </p>
        <div className="mt-4 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium inline-block">
          {role}
        </div>
      </div>
    </div>
  );
}
