/**
 * useTeacherState — Local-first teacher state from Portal DB cache.
 * Reads teacher_state_cache first; only calls CRM sync if missing/stale.
 * Eliminates live CRM dependency on every page render.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { portalInvoke } from '@/api/portalInvoke';

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export interface TeacherState {
  found: boolean;
  portalAuthUserId: string | null;
  crmStaffId: string | null;
  role: string | null;
  accessScope: string | null;
  isActive: boolean;
  approvalStatus: string | null;
  identityVerified: boolean;
  educationVerified: boolean;
  canTeach: boolean;
  blockers: string[];
  fullName: string | null;
  email: string | null;
  phone: string | null;
  reviewerNotes: string | null;
  rejectionReason: string | null;
  moreInfoReason: string | null;
  syncedAt: string | null;
  loading: boolean;
  resolved: boolean;
  syncing: boolean;
  refresh: () => Promise<void>;
}

const EMPTY: Omit<TeacherState, 'loading' | 'resolved' | 'syncing' | 'refresh'> = {
  found: false,
  portalAuthUserId: null,
  crmStaffId: null,
  role: null,
  accessScope: null,
  isActive: false,
  approvalStatus: null,
  identityVerified: false,
  educationVerified: false,
  canTeach: false,
  blockers: [],
  fullName: null,
  email: null,
  phone: null,
  reviewerNotes: null,
  rejectionReason: null,
  moreInfoReason: null,
  syncedAt: null,
};

function mapRow(row: any): Omit<TeacherState, 'loading' | 'resolved' | 'syncing' | 'refresh'> {
  return {
    found: true,
    portalAuthUserId: row.portal_auth_user_id,
    crmStaffId: row.crm_staff_id,
    role: row.role,
    accessScope: row.access_scope,
    isActive: row.is_active === true,
    approvalStatus: row.approval_status,
    identityVerified: row.identity_verified === true,
    educationVerified: row.education_verified === true,
    canTeach: row.can_teach === true,
    blockers: Array.isArray(row.blockers) ? row.blockers : [],
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    reviewerNotes: row.reviewer_notes,
    rejectionReason: row.rejection_reason,
    moreInfoReason: row.more_info_reason,
    syncedAt: row.synced_at,
  };
}

function isStale(syncedAt: string | null): boolean {
  if (!syncedAt) return true;
  return Date.now() - new Date(syncedAt).getTime() > STALE_THRESHOLD_MS;
}

export function useTeacherState(enabled: boolean): TeacherState {
  const [state, setState] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncInProgress = useRef(false);

  // Force sync from CRM and persist locally
  const syncFromCrm = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    setSyncing(true);
    try {
      const res = await portalInvoke<any>('sync_teacher_state');
      if (res.ok && res.data?.synced) {
        setState(mapRow(res.data.state));
      } else {
        console.warn('[useTeacherState] Sync failed:', res.error || res.data?.error);
      }
    } catch (err) {
      console.error('[useTeacherState] Sync exception:', err);
    } finally {
      setSyncing(false);
      syncInProgress.current = false;
      setResolved(true);
    }
  }, []);

  // Read local cache first, then sync if missing/stale
  const resolve = useCallback(async () => {
    if (!enabled) {
      setState(EMPTY);
      setResolved(true);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setState(EMPTY);
        setResolved(true);
        setLoading(false);
        return;
      }

      // 1. Read local cache
      const { data: cached, error: cacheErr } = await supabase
        .from('teacher_state_cache')
        .select('*')
        .eq('portal_auth_user_id', session.user.id)
        .maybeSingle();

      if (cacheErr) {
        console.warn('[useTeacherState] Cache read error:', cacheErr.message);
      }

      if (cached && !isStale(cached.synced_at)) {
        // Local cache is fresh — use it
        console.log('[useTeacherState] ✅ Using local cached state (synced:', cached.synced_at, ')');
        setState(mapRow(cached));
        setResolved(true);
        setLoading(false);
        return;
      }

      // 2. Missing or stale — do one CRM sync
      console.log('[useTeacherState] 🔄 Local state missing/stale, syncing from CRM...');
      await syncFromCrm();
    } catch (err) {
      console.error('[useTeacherState] Resolve error:', err);
      setState(EMPTY);
    } finally {
      setLoading(false);
      setResolved(true);
    }
  }, [enabled, syncFromCrm]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return { ...state, loading, resolved, syncing, refresh: syncFromCrm };
}
