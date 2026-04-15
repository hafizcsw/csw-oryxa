/**
 * StaffGuard — Route protection component that consumes CRM staff authority.
 * Blocks access for non-staff users and redirects to appropriate paths.
 * SCOPE ENFORCEMENT: crm_only staff are denied Portal access.
 */
import { Navigate } from 'react-router-dom';
import { useStaffAuthority } from '@/hooks/useStaffAuthority';
import { PageLoader } from '@/components/ui/PageLoader';
import type { StaffRole } from '@/types/staff';
import { STAFF_LANDING_PATHS } from '@/types/staff';

interface StaffGuardProps {
  children: React.ReactNode;
  /** Specific roles allowed. If empty/undefined, any staff role is allowed. */
  allowedRoles?: StaffRole[];
  /** Where to redirect non-staff users. Defaults to '/' */
  fallbackPath?: string;
}

export function StaffGuard({ 
  children, 
  allowedRoles, 
  fallbackPath = '/' 
}: StaffGuardProps) {
  const { isStaff, role, loading, resolved } = useStaffAuthority();

  // Still resolving authority
  if (loading || !resolved) {
    return <PageLoader />;
  }

  // Not authenticated, not staff, or crm_only scope → redirect
  // Note: isStaff already incorporates scope check (portal_only | crm_and_portal)
  if (!isStaff || !role) {
    return <Navigate to={fallbackPath} replace />;
  }

  // If specific roles are required, check
  if (allowedRoles && allowedRoles.length > 0) {
    if (role !== 'super_admin' && !allowedRoles.includes(role)) {
      const correctPath = STAFF_LANDING_PATHS[role] || fallbackPath;
      return <Navigate to={correctPath} replace />;
    }
  }

  return <>{children}</>;
}
