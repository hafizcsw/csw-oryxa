/**
 * useIsAdmin — Resolves super_admin authority from CRM staff truth ONLY.
 * Requires role=super_admin AND access_scope includes Portal.
 */
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { portalInvoke } from '@/api/portalInvoke';
import { scopeIncludesPortal } from '@/types/staff';
import type { AccessScope } from '@/types/staff';

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminStatus();
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const res = await portalInvoke<{
        is_staff: boolean;
        role: string | null;
        access_scope: AccessScope | null;
      }>('resolve_staff_authority');
      
      if (res.ok && res.data) {
        setIsAdmin(
          res.data.is_staff &&
          res.data.role === 'super_admin' &&
          scopeIncludesPortal(res.data.access_scope)
        );
      } else {
        console.warn('[useIsAdmin] CRM resolution failed — denying admin access');
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('[useIsAdmin] Exception:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return useMemo(() => ({ isAdmin, loading }), [isAdmin, loading]);
}
