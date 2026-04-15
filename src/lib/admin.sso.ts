/**
 * @deprecated CUTOVER COMPLETE — This module now delegates to CRM staff authority.
 * Admin access requires CRM role=super_admin AND access_scope includes Portal.
 */
import { supabase } from "@/integrations/supabase/client";
import { portalInvoke } from "@/api/portalInvoke";
import { scopeIncludesPortal } from "@/types/staff";
import type { AccessScope } from "@/types/staff";

export async function verifyAdminSSOFromURL(): Promise<{ok: boolean; payload?: any}> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[admin.sso] No active session');
      return { ok: false };
    }

    const res = await portalInvoke<{
      is_staff: boolean;
      role: string | null;
      access_scope: AccessScope | null;
      email?: string;
    }>('resolve_staff_authority');

    if (!res.ok || !res.data) {
      console.warn('[admin.sso] CRM staff resolution failed:', res.error);
      return { ok: false };
    }

    const { is_staff, role, access_scope } = res.data;

    if (!is_staff || role !== 'super_admin') {
      console.warn('[admin.sso] User is not super_admin. role=', role);
      return { ok: false };
    }

    if (!scopeIncludesPortal(access_scope)) {
      console.warn('[admin.sso] super_admin has crm_only scope — Portal access denied. scope=', access_scope);
      return { ok: false };
    }

    console.log('[admin.sso] ✅ CRM super_admin + Portal scope confirmed for', session.user.email);
    return {
      ok: true,
      payload: {
        name: session.user.email || 'Admin',
        user_id: session.user.id,
        email: session.user.email,
      },
    };
  } catch (error) {
    console.error('[admin.sso] Verification failed:', error);
    return { ok: false };
  }
}

export function requireAdmin(ok: boolean) {
  if (!ok) {
    console.warn('[admin.sso] Access denied - redirecting to home');
    window.location.href = '/';
  }
}
