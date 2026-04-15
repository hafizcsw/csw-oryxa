/**
 * Institution Route Guard
 * Ensures only institution accounts can access institution routes
 * Supports super-admin preview override
 */
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useInstitutionAccess } from '@/hooks/useInstitutionAccess';
import { PageLoader } from '@/components/ui/PageLoader';
import type { InstitutionAccessState } from '@/types/institution';

interface InstitutionGuardProps {
  children: React.ReactNode;
  allowedStates?: InstitutionAccessState[];
  requiredModule?: string;
}

/** Check if super-admin preview is active */
function isPreviewActive() {
  try {
    const raw = sessionStorage.getItem('institution_preview_ctx');
    if (raw) {
      const ctx = JSON.parse(raw);
      return ctx?.active === true;
    }
  } catch {}
  return false;
}

export function InstitutionGuard({ children, allowedStates, requiredModule }: InstitutionGuardProps) {
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isInstitution, setIsInstitution] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const location = useLocation();
  const { loading, accessState, isModuleAllowed, getRoute, isPreviewMode } = useInstitutionAccess();

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthed(!!session);
      
      const accountType = session?.user?.user_metadata?.account_type;
      setIsInstitution(accountType === 'institution');

      // Check if super admin
      if (session?.user) {
        try {
          const { data } = await supabase.rpc('is_admin', { _user_id: session.user.id as any });
          setIsSuperAdmin(data === true);
        } catch {
          const claimAdmin = (session.user.app_metadata as any)?.is_admin === true;
          setIsSuperAdmin(claimAdmin);
        }
      }

      setAuthReady(true);
    }
    check();
  }, []);

  if (!authReady || loading) return <PageLoader />;
  if (!isAuthed) return <Navigate to="/?auth=1" replace />;

  // Super admin with active preview bypasses institution account_type check
  const previewActive = isPreviewMode || isPreviewActive();
  if (!isInstitution && !previewActive) return <Navigate to="/" replace />;
  if (!isInstitution && previewActive && !isSuperAdmin) return <Navigate to="/" replace />;

  // If specific states are required, check
  if (allowedStates && accessState && !allowedStates.includes(accessState)) {
    const correctRoute = getRoute();
    if (correctRoute !== location.pathname) {
      return <Navigate to={correctRoute} replace />;
    }
  }

  // If a specific module is required, check
  if (requiredModule && !isModuleAllowed(requiredModule)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
