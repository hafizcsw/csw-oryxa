/**
 * useStaffAuthority — Consumes CRM staff authority for Portal access routing.
 * Portal does NOT own staff roles. This hook resolves authority from CRM
 * via the student-portal-api edge function.
 * 
 * SCOPE ENFORCEMENT: Portal access requires access_scope = portal_only | crm_and_portal.
 * crm_only staff are treated as non-Portal-staff.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { portalInvoke } from '@/api/portalInvoke';
import type { StaffRole, AccessScope, StaffAuthority, TeacherTruth } from '@/types/staff';
import { scopeIncludesPortal, STAFF_LANDING_PATHS, STAFF_ROUTE_ACCESS } from '@/types/staff';

/**
 * PERSISTENT CACHE: Teacher/staff authority is verified once via CRM,
 * then cached permanently in localStorage. No repeated CRM calls.
 * Cache is only cleared on: sign-out, or explicit admin revocation.
 */
const PERSISTENT_CACHE_KEY = 'staff_authority_persistent_v3';

interface CachedAuthority {
  role: StaffRole | null;
  accessScope: AccessScope | null;
  email: string | null;
  resolvedAt: number;
  teacherTruth?: TeacherTruth | null;
}

function getCachedAuthority(): CachedAuthority | null {
  try {
    const raw = localStorage.getItem(PERSISTENT_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedAuthority;
  } catch {
    return null;
  }
}

function setCachedAuthority(
  role: StaffRole | null,
  accessScope: AccessScope | null,
  email: string | null,
  teacherTruth?: TeacherTruth | null,
) {
  try {
    const entry: CachedAuthority = { role, accessScope, email, resolvedAt: Date.now(), teacherTruth };
    localStorage.setItem(PERSISTENT_CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

export function clearStaffAuthorityCache() {
  localStorage.removeItem(PERSISTENT_CACHE_KEY);
  // Clean up legacy keys
  sessionStorage.removeItem('staff_authority_cache_v2');
  sessionStorage.removeItem('staff_authority_cache_v1');
  localStorage.removeItem('cached_staff_role');
  localStorage.removeItem('cached_staff_scope');
}

export function useStaffAuthority(): StaffAuthority & {
  loading: boolean;
  getLandingPath: () => string;
  canAccessRoute: (path: string) => boolean;
  refresh: () => void;
} {
  const [role, setRole] = useState<StaffRole | null>(null);
  const [accessScope, setAccessScope] = useState<AccessScope | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [teacherTruth, setTeacherTruth] = useState<TeacherTruth | null>(null);
  const [resolved, setResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  const resolve = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setRole(null);
        setAccessScope(null);
        setEmail(null);
        setResolved(true);
        setLoading(false);
        return;
      }

      const cached = getCachedAuthority();
      if (cached && cached.role !== null) {
        setRole(cached.role);
        setAccessScope(cached.accessScope);
        setEmail(cached.email);
        setTeacherTruth(cached.teacherTruth || null);
        setResolved(true);
        setLoading(false);
        return;
      }

      const res = await portalInvoke<{ 
        is_staff: boolean; 
        role: StaffRole | null; 
        access_scope: AccessScope | null;
        email: string | null;
        // Teacher truth fields (only present when role=teacher)
        approval_status?: string | null;
        identity_verified?: boolean;
        education_verified?: boolean;
        can_teach?: boolean;
        blockers?: string[];
        full_name?: string | null;
        phone?: string | null;
        reviewer_notes?: string | null;
        rejection_reason?: string | null;
        more_info_reason?: string | null;
      }>('resolve_staff_authority');

      if (res.ok && res.data) {
        const staffRole = res.data.is_staff ? res.data.role : null;
        const scope = res.data.access_scope || null;
        setRole(staffRole);
        setAccessScope(scope);
        setEmail(res.data.email || session.user.email || null);

        // Extract teacher truth if present
        const tt: TeacherTruth | null = (staffRole === 'teacher' && res.data.approval_status !== undefined)
          ? {
              approvalStatus: res.data.approval_status || null,
              identityVerified: res.data.identity_verified === true,
              educationVerified: res.data.education_verified === true,
              canTeach: res.data.can_teach === true,
              blockers: res.data.blockers || [],
              fullName: res.data.full_name || null,
              phone: res.data.phone || null,
              reviewerNotes: res.data.reviewer_notes || null,
              rejectionReason: res.data.rejection_reason || null,
              moreInfoReason: res.data.more_info_reason || null,
            }
          : null;
        setTeacherTruth(tt);

        setCachedAuthority(staffRole, scope, res.data.email || session.user.email || null, tt);
      } else {
        console.warn('[useStaffAuthority] Resolution failed:', res.error);
        setRole(null);
        setAccessScope(null);
        setEmail(session.user.email || null);
        setTeacherTruth(null);
      }
      setResolved(true);
    } catch (err) {
      console.error('[useStaffAuthority] Exception:', err);
      setRole(null);
      setAccessScope(null);
      setTeacherTruth(null);
      setResolved(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    resolve();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearStaffAuthorityCache();
        setRole(null);
        setAccessScope(null);
        setEmail(null);
        setTeacherTruth(null);
        setResolved(true);
        setLoading(false);
      } else if (event === 'SIGNED_IN') {
        // Only re-resolve on fresh sign-in, NOT on TOKEN_REFRESHED
        resolve();
      }
      // TOKEN_REFRESHED and INITIAL_SESSION: do nothing — 
      // session is alive, authority already resolved on mount
    });

    return () => subscription.unsubscribe();
  }, [resolve]);

  // SCOPE ENFORCEMENT: isStaff for Portal purposes requires Portal-inclusive scope
  const hasPortalScope = scopeIncludesPortal(accessScope);
  const isStaff = role !== null && hasPortalScope;

  const getLandingPath = useCallback(() => {
    if (!role || !hasPortalScope) return '/';
    return STAFF_LANDING_PATHS[role] || '/';
  }, [role, hasPortalScope]);

  const canAccessRoute = useCallback((path: string) => {
    if (!role || !hasPortalScope) return false;
    if (role === 'super_admin') return true;
    for (const [prefix, allowedRoles] of Object.entries(STAFF_ROUTE_ACCESS)) {
      if (path.startsWith(prefix)) {
        return allowedRoles.includes(role);
      }
    }
    return false;
  }, [role, hasPortalScope]);

  const refresh = useCallback(() => {
    clearStaffAuthorityCache();
    resolve();
  }, [resolve]);

  return useMemo(() => ({
    isStaff,
    role,
    accessScope,
    email,
    teacherTruth,
    resolved,
    loading,
    getLandingPath,
    canAccessRoute,
    refresh,
  }), [isStaff, role, accessScope, email, teacherTruth, resolved, loading, getLandingPath, canAccessRoute, refresh]);
}
