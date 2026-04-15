/**
 * useTeacherProfile — Unified teacher profile for /account surfaces.
 * Local-first: reads teacher truth from teacher_state_cache.
 * Documents: fetched from Portal DB teacher_documents table.
 * NO live CRM calls for approval/verification truth on every mount.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { portalInvoke } from '@/api/portalInvoke';

export interface TeacherDocument {
  file_id: string;
  file_kind: string;
  file_name: string;
  status: string; // pending | verified | rejected | needs_reupload
  rejection_reason?: string | null;
  reviewer_notes?: string | null;
  uploaded_at: string;
  file_url?: string | null;
}

export interface TeacherProfileState {
  found: boolean;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  isActive: boolean;
  accessScope: string | null;
  approvalStatus: string | null;
  identityVerified: boolean;
  educationVerified: boolean;
  canTeach: boolean;
  blockers: string[];
  reviewerNotes: string | null;
  rejectionReason: string | null;
  moreInfoReason: string | null;
  documents: TeacherDocument[];
  loading: boolean;
  resolved: boolean;
  refresh: () => void;
}

const STALE_MS = 30 * 60 * 1000; // 30 minutes

const EMPTY_STATE: Omit<TeacherProfileState, 'loading' | 'resolved' | 'refresh'> = {
  found: false,
  fullName: null,
  email: null,
  phone: null,
  role: null,
  isActive: false,
  accessScope: null,
  approvalStatus: null,
  identityVerified: false,
  educationVerified: false,
  canTeach: false,
  blockers: [],
  reviewerNotes: null,
  rejectionReason: null,
  moreInfoReason: null,
  documents: [],
};

export function useTeacherProfile(isTeacherCapable: boolean): TeacherProfileState {
  const [state, setState] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState(false);

  const resolve = useCallback(async () => {
    if (!isTeacherCapable) {
      setState({ ...EMPTY_STATE, blockers: ['not_teacher_role'] });
      setResolved(true);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setState({ ...EMPTY_STATE, blockers: ['no_session'] });
        setResolved(true);
        setLoading(false);
        return;
      }

      // 1. Read local teacher_state_cache (local-first)
      const { data: cached } = await supabase
        .from('teacher_state_cache')
        .select('*')
        .eq('portal_auth_user_id', session.user.id)
        .maybeSingle();

      // 2. If stale or missing, trigger background sync
      const isStale = !cached?.synced_at || (Date.now() - new Date(cached.synced_at).getTime() > STALE_MS);
      if (isStale) {
        // Fire sync in background — don't block UI
        portalInvoke<any>('sync_teacher_state').then((syncRes: any) => {
          if (syncRes.ok && syncRes.data?.synced) {
            console.log('[useTeacherProfile] Background sync completed, re-resolving...');
            resolve(); // Re-resolve with fresh data
          }
        }).catch(err => {
          console.warn('[useTeacherProfile] Background sync failed:', err);
        });
      }

      // 3. Use cached data if available (even if stale — better than nothing)
      const truthSource = cached;

      // 4. Fetch documents from Portal DB
      let docs: TeacherDocument[] = [];
      try {
        const docsRes = await portalInvoke<{ documents: TeacherDocument[] }>('teacher_list_documents');
        if (docsRes.ok && docsRes.data?.documents) {
          docs = docsRes.data.documents;
        }
      } catch (docErr) {
        console.warn('[useTeacherProfile] Documents fetch failed:', docErr);
      }

      if (truthSource) {
        const blockers = Array.isArray(truthSource.blockers) 
          ? truthSource.blockers 
          : (typeof truthSource.blockers === 'string' ? JSON.parse(truthSource.blockers || '[]') : []);

        setState({
          found: true,
          fullName: truthSource.full_name || null,
          email: truthSource.email || null,
          phone: truthSource.phone || null,
          role: truthSource.role || null,
          isActive: truthSource.is_active === true,
          accessScope: truthSource.access_scope || null,
          approvalStatus: truthSource.approval_status || null,
          identityVerified: truthSource.identity_verified === true,
          educationVerified: truthSource.education_verified === true,
          canTeach: truthSource.can_teach === true,
          blockers,
          reviewerNotes: truthSource.reviewer_notes || null,
          rejectionReason: truthSource.rejection_reason || null,
          moreInfoReason: truthSource.more_info_reason || null,
          documents: docs,
        });
      } else {
        // No cache at all — show empty state, sync will populate it
        setState({ ...EMPTY_STATE, documents: docs, blockers: ['syncing'] });
      }
    } catch (err) {
      console.error('[useTeacherProfile] Error:', err);
      setState({ ...EMPTY_STATE, blockers: ['resolution_error'] });
    } finally {
      setLoading(false);
      setResolved(true);
    }
  }, [isTeacherCapable]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return { ...state, loading, resolved, refresh: resolve };
}
