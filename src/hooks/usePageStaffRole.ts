/**
 * Resolves the current user's page staff role for a given university.
 * Uses the university-page-manage edge function.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PageStaffRole =
  | 'full_control'
  | 'page_admin'
  | 'content_publisher'
  | 'moderator'
  | 'inbox_agent'
  | 'analyst'
  | 'live_community_manager';

interface PageStaffState {
  loading: boolean;
  role: PageStaffRole | null;
  isStaff: boolean;
  isSuperAdmin: boolean;
}

export function usePageStaffRole(universityId: string | null | undefined): PageStaffState {
  const [state, setState] = useState<PageStaffState>({
    loading: true,
    role: null,
    isStaff: false,
    isSuperAdmin: false,
  });

  useEffect(() => {
    if (!universityId) {
      setState({ loading: false, role: null, isStaff: false, isSuperAdmin: false });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('university-page-manage', { body: { action: 'staff.my_role', university_id: universityId } });

        if (cancelled) return;
        if (error || !data?.ok) {
          setState({ loading: false, role: null, isStaff: false, isSuperAdmin: false });
          return;
        }

        setState({
          loading: false,
          role: data.role as PageStaffRole | null,
          isStaff: !!data.is_staff,
          isSuperAdmin: !!data.is_super_admin,
        });
      } catch {
        if (!cancelled) setState({ loading: false, role: null, isStaff: false, isSuperAdmin: false });
      }
    })();

    return () => { cancelled = true; };
  }, [universityId]);

  return state;
}
