import { useCallback, useRef } from 'react';
import { useMalakChat } from '@/contexts/MalakChatContext';
import { shortlistAdd, shortlistRemove } from '@/lib/portalApi';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { track } from '@/lib/analytics';
import { trackShortlistAdded } from '@/lib/decisionTracking';
import { toast } from 'sonner';
import type { ProgramSnapshot } from '@/types/shortlist';
import { buildProgramSnapshot } from '@/types/shortlist';
// ✅ EXEC ORDER: Workflow Tracing
import { getClientTraceId } from '@/lib/workflow';

const MAX_SHORTLIST = 5;
const SNAPSHOT_CACHE_KEY = 'shortlist_snapshot_cache_v1';

// ✅ P1 Fix V2: Snapshot validation helper (supports both program_id and program_ref_id)
function isValidProgramSnapshot(snapshot: ProgramSnapshot | null | undefined): boolean {
  if (!snapshot?.snapshot) return false;
  const s = snapshot.snapshot;
  
  // Must have at least one name (AR or EN)
  const hasName = !!(s.program_name_en || s.program_name_ar);
  const hasUni = !!(s.university_name_en || s.university_name_ar);
  const hasUrl = !!s.portal_url;
  // ✅ P1 Fix V2: Accept EITHER program_ref_id OR program_id (not just program_ref_id)
  const hasId = !!(snapshot.program_ref_id || (snapshot as any).program_id);
  
  return hasName && hasUni && hasUrl && hasId;
}

// ✅ In-memory snapshot cache (source of truth for sync)
const snapshotCache = new Map<string, ProgramSnapshot>();

// ✅ P0 Fix: Helper functions for localStorage persistence
function getLocalSnapshotCache(): Record<string, ProgramSnapshot> {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOT_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveToLocalSnapshotCache(id: string, snapshot: ProgramSnapshot) {
  try {
    const cache = getLocalSnapshotCache();
    cache[id] = snapshot;
    localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[useUnifiedShortlist] Failed to save cache:', e);
  }
}

function removeFromLocalSnapshotCache(id: string) {
  try {
    const cache = getLocalSnapshotCache();
    delete cache[id];
    localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[useUnifiedShortlist] Failed to update cache:', e);
  }
}

// ✅ PATCH 1.1: Unified ID getter - ALWAYS use this for ID comparisons
// ✅ V4.4 FIX: Handle string IDs directly (was returning '' for strings!)
function getId(v: any): string {
  // If it's already a string, return it as-is
  if (typeof v === 'string') return v;
  // Otherwise extract from object
  return String(v?.program_id || v?.program_ref_id || v?.id || '');
}

// ✅ P0 PATCH 1.1: Purge guest_shortlist (handles both array and object formats)
function purgeGuestShortlist(programId: string) {
  try {
    const key = 'guest_shortlist';
    const raw = localStorage.getItem(key);
    if (!raw) return;
    
    const parsed = JSON.parse(raw);
    const targetId = String(programId);
    
    // If array format
    if (Array.isArray(parsed)) {
      const next = parsed.filter((id: any) => String(id) !== targetId);
      localStorage.setItem(key, JSON.stringify(next));
      console.log('[useUnifiedShortlist] 🗑️ Purged from guest_shortlist (array):', programId);
      return;
    }
    
    // If object/map format
    if (typeof parsed === 'object' && parsed) {
      delete parsed[targetId];
      localStorage.setItem(key, JSON.stringify(parsed));
      console.log('[useUnifiedShortlist] 🗑️ Purged from guest_shortlist (object):', programId);
      return;
    }
  } catch (e) {
    console.warn('[useUnifiedShortlist] Failed to purge guest_shortlist:', e);
  }
}

// ✅ P0 PATCH 1.1: Purge snapshot cache
function purgeSnapshotCache(programId: string) {
  try {
    const key = 'shortlist_snapshot_cache_v1';
    const raw = localStorage.getItem(key);
    if (!raw) return;
    
    const cache = JSON.parse(raw);
    const targetId = String(programId);
    delete cache[targetId];
    localStorage.setItem(key, JSON.stringify(cache));
    console.log('[useUnifiedShortlist] 🗑️ Purged from snapshot cache:', programId);
  } catch (e) {
    console.warn('[useUnifiedShortlist] Failed to purge snapshot cache:', e);
  }
}

// Export getId for external use
export { getId as getUnifiedProgramId };

// ✅ Initialize snapshotCache from localStorage on module load
const storedCache = getLocalSnapshotCache();
Object.entries(storedCache).forEach(([id, snap]) => {
  snapshotCache.set(id, snap as ProgramSnapshot);
});
console.log('[useUnifiedShortlist] 📦 Loaded', snapshotCache.size, 'snapshots from localStorage');

// ✅ Export snapshot cache getter for external use (hydration, ServicesTab)
export function getSnapshotFromCache(programId: string): ProgramSnapshot | undefined {
  return snapshotCache.get(programId);
}

/**
 * @deprecated Use useGuestAwareShortlist for UI components instead.
 * useGuestAwareShortlist wraps usePortalShortlist (CRM) + localStorage guest draft.
 * This hook is kept only for legacy MalakChatContext integration.
 */
export function useUnifiedShortlist() {
  const qc = useQueryClient();
  const { 
    shortlist, 
    addToShortlist: contextAdd, 
    removeFromShortlist: contextRemove,
  } = useMalakChat();
  
  const isSyncing = useRef(false);

  /**
   * ✅ P0 FIX: Delta-based add (no full-sync, no flicker)
   * Calls shortlist_add action which uses rpc_shortlist_add_v1
   */
  const deltaAdd = useCallback(async (programId: string, snapshot?: ProgramSnapshot) => {
    // Check for Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('[useUnifiedShortlist] ⚠️ No session, skipping CRM add (local only)');
      return { ok: true, local_only: true };
    }

    console.log('[useUnifiedShortlist] 📤 Delta ADD to CRM:', { program_id: programId });
    
    const result = await shortlistAdd(
      programId, 
      snapshot?.snapshot as Record<string, unknown> | undefined,
      'portal_web_shortlist'
    );
    
    if (result?.ok) {
      qc.invalidateQueries({ queryKey: ['shortlist'] });
      qc.invalidateQueries({ queryKey: ['portal-shortlist'] });
      console.log('[useUnifiedShortlist] ✅ Delta ADD success:', result);
    } else {
      console.warn('[useUnifiedShortlist] ⚠️ Delta ADD failed:', result);
    }
    
    return result;
  }, [qc]);

  /**
   * ✅ P0 FIX: Delta-based remove (no full-sync, no flicker)
   * Calls shortlist_remove action which uses rpc_shortlist_remove_v1
   */
  const deltaRemove = useCallback(async (programId: string) => {
    // Check for Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('[useUnifiedShortlist] ⚠️ No session, skipping CRM remove (local only)');
      return { ok: true, local_only: true };
    }

    console.log('[useUnifiedShortlist] 📤 Delta REMOVE from CRM:', { program_id: programId });
    
    const result = await shortlistRemove(programId, 'portal_web_shortlist');
    
    if (result?.ok) {
      qc.invalidateQueries({ queryKey: ['shortlist'] });
      qc.invalidateQueries({ queryKey: ['portal-shortlist'] });
      console.log('[useUnifiedShortlist] ✅ Delta REMOVE success:', result);
    } else {
      console.warn('[useUnifiedShortlist] ⚠️ Delta REMOVE failed:', result);
    }
    
    return result;
  }, [qc]);

  /**
   * @deprecated Legacy full-sync - replaced by delta operations
   * Kept for manual "Sync All" button if needed
   */
  const syncToCRM = useCallback(async (_allowClear = false) => {
    console.warn('[useUnifiedShortlist] ⚠️ syncToCRM is deprecated, use delta add/remove');
    return { ok: true, deprecated: true };
  }, []);

  /**
   * Add program with snapshot (V3 - recommended)
   * ✅ P0 FIX: Uses delta add instead of full-sync
   * 
   * @param programData - Program data from UI with CRM-compatible fields
   */
  const addWithSnapshot = useCallback(async (programData: {
    program_id: string;
    program_name?: string;
    program_name_ar?: string;
    program_slug?: string;
    university_name?: string;
    university_name_ar?: string;
    university_logo?: string;
    country_name?: string;
    country_name_ar?: string;
    country_code?: string;
    country_slug?: string;
    degree_name?: string;
    degree_slug?: string;
    language?: string;
    duration_months?: number | null;
    fees_yearly?: number | null;
    tuition_usd_min?: number | null;
    tuition_usd_max?: number | null;
    city?: string | null;
  }) => {
    // ✅ PATCH 1.2: Normalize ID for all comparisons
    const programId = getId(programData.program_id);
    
    if (!programId) {
      console.error('[useUnifiedShortlist] ❌ Empty program ID, blocking add');
      toast.error('تعذر حفظ البرنامج (معرف فارغ)');
      return;
    }
    
    // ✅ PATCH 1.2: Use normalized comparison
    if (shortlist.some(id => getId(id) === programId)) {
      console.log('[useUnifiedShortlist] ⏭️ Already in shortlist:', programId);
      return;
    }

    if (shortlist.length >= MAX_SHORTLIST) {
      toast.error(`يمكنك إضافة ${MAX_SHORTLIST} برامج كحد أقصى`);
      return;
    }

    // 1) Build and cache snapshot FIRST
    const snapshot = buildProgramSnapshot(programData);
    
    // ✅ P1 Fix: Validate snapshot before saving
    if (!isValidProgramSnapshot(snapshot)) {
      console.error('[useUnifiedShortlist] ❌ Invalid snapshot, blocking add:', {
        program_id: programId,
        has_name: !!(snapshot.snapshot?.program_name_en || snapshot.snapshot?.program_name_ar),
        has_uni: !!(snapshot.snapshot?.university_name_en || snapshot.snapshot?.university_name_ar),
        has_url: !!snapshot.snapshot?.portal_url,
        has_ref_id: !!snapshot.program_ref_id,
      });
      toast.error('تعذر حفظ البرنامج (بيانات ناقصة)');
      return;
    }
    
    snapshotCache.set(programId, snapshot);
    saveToLocalSnapshotCache(programId, snapshot);
    
    // ✅ EXEC ORDER: WF Log for program selection
    const clientTraceId = getClientTraceId();
    console.log('[WF] program_select', { 
      program_id: programId, 
      has_snapshot: true, 
      client_trace_id: clientTraceId,
      snapshot_valid: isValidProgramSnapshot(snapshot),
    });
    
    // ✅ P0 Evidence Log
    console.log('[PORTAL:SHORTLIST:❤️ ADD] DELTA MODE', {
      program_id: programId,
      snapshot_saved: true,
      program_name: snapshot.snapshot.program_name_en || snapshot.snapshot.program_name_ar,
      university: snapshot.snapshot.university_name_en || snapshot.snapshot.university_name_ar,
      portal_url: snapshot.snapshot.portal_url,
      client_trace_id: clientTraceId,
    });

    // 2) Add to local context (optimistic UI)
    contextAdd(programId);
    track('shortlist_added', { program_id: programId });
    trackShortlistAdded(programId);
    toast.success('تمت الإضافة للمفضلة ❤️');
    
    // 3) ✅ P0 FIX: Use delta add instead of full-sync
    await deltaAdd(programId, snapshot);
  }, [shortlist, contextAdd, deltaAdd]);

  /**
   * Legacy add (ID only) - still works but less reliable
   * ✅ P0 FIX: Uses delta add instead of full-sync
   * @deprecated Use addWithSnapshot instead
   */
  const add = useCallback(async (programId: string) => {
    // ✅ PATCH 1.2: Normalize ID
    const normalizedId = getId(programId);
    
    // ✅ PATCH 1.2: Use normalized comparison
    if (shortlist.some(id => getId(id) === normalizedId)) return;

    if (shortlist.length >= MAX_SHORTLIST) {
      toast.error(`يمكنك إضافة ${MAX_SHORTLIST} برامج كحد أقصى`);
      return;
    }

    console.log('[useUnifiedShortlist] ⚠️ Legacy add (no snapshot):', programId);
    
    contextAdd(programId);
    track('shortlist_added', { program_id: programId });
    trackShortlistAdded(programId);
    toast.success('تمت الإضافة للمفضلة ❤️');
    
    // ✅ P0 FIX: Use delta add instead of full-sync
    await deltaAdd(programId);
  }, [shortlist, contextAdd, deltaAdd]);

  /**
   * Remove program from shortlist
   * ✅ PORTAL-4: Server-First pattern - only remove locally AFTER server confirms success
   * ✅ PORTAL-A: Handle LOCK case (program already submitted/paid)
   * This prevents "disappearing favorites" bug
   */
  const remove = useCallback(async (programId: string): Promise<{ ok: boolean; error?: string; locked?: boolean }> => {
    // ✅ PATCH 1.2: Normalize ID for all comparisons
    const normalizedId = getId(programId);
    
    // ✅ DBG: Log before guard to debug UUID vs ref_id mismatch
    console.log('[DBG:REMOVE]', {
      programId,
      normalizedId,
      inShortlist: shortlist.some(id => getId(id) === normalizedId),
      shortlist_sample: shortlist.slice(0, 3),
      shortlist_full: shortlist,
    });
    
    // ✅ FIX: Don't skip RPC when local shortlist is empty — server may have data
    // Only log a warning but still proceed with server-side removal
    if (!shortlist.some(id => getId(id) === normalizedId)) {
      console.warn('[PORTAL:SHORTLIST:💔 REMOVE] ID not in local shortlist, but proceeding with server removal:', {
        programId,
        normalizedId,
        shortlist_sample: shortlist.slice(0, 3),
      });
    }

    // ✅ P0 Evidence Log
    console.log('[PORTAL:SHORTLIST:💔 REMOVE] SERVER-FIRST MODE', {
      program_id: programId,
      old_length: shortlist.length,
    });
    
    // 1) ✅ PORTAL-4: Call server FIRST - do NOT update local state yet
    const syncResult = await deltaRemove(programId);
    
    // 2) ✅ PORTAL-A: Check for LOCK (program submitted/paid)
    // Use optional chaining and 'in' operator for type safety
    const errorCode = 'error_code' in syncResult ? syncResult.error_code : undefined;
    const rpcError = 'rpc_error' in syncResult ? syncResult.rpc_error : undefined;
    const messageField = 'message' in syncResult ? syncResult.message : undefined;
    
    const isLocked = errorCode === 'LOCKED' || 
                     rpcError?.includes('LOCKED') ||
                     rpcError?.includes('cannot remove');
    
    if (isLocked) {
      console.log('[PORTAL:SHORTLIST:💔 REMOVE] 🔒 Program is LOCKED (submitted/paid)');
      toast.error('لا يمكن حذف هذا البرنامج بعد التقديم أو الدفع');
      return { ok: false, error: 'LOCKED', locked: true };
    }
    
    // 3) Check server response - handle both response shapes
    const isSuccess = syncResult?.ok === true || 
      ('rpc_ok' in syncResult && syncResult.rpc_ok === true) ||
      ('local_only' in syncResult && syncResult.local_only === true);
    
    if (isSuccess) {
      // ✅ Server confirmed deletion - NOW safe to update ALL local state
      // PATCH 1: Clear ALL caches that could resurrect the deleted item
      contextRemove(programId);
      snapshotCache.delete(programId);
      removeFromLocalSnapshotCache(programId);
      
      // ✅ PATCH 1.1: Purge ALL localStorage caches properly
      purgeGuestShortlist(programId);
      purgeSnapshotCache(programId);
      
      track('shortlist_removed', { program_id: programId });
      toast.success('تمت الإزالة من المفضلة');
      
      console.log('[PORTAL:SHORTLIST:💔 REMOVE] ✅ Server success, ALL caches purged');
      return { ok: true };
    } else {
      // ❌ Server failed - DO NOT remove from local state
      const errorMsg = rpcError || messageField || 'فشل الحذف من الخادم';
      console.error('[PORTAL:SHORTLIST:💔 REMOVE] ❌ Server failed, preserving local state:', errorMsg);
      toast.error('فشلت عملية الحذف، حاول مرة أخرى');
      return { ok: false, error: errorMsg };
    }
  }, [shortlist, contextRemove, deltaRemove]);

  /**
   * Toggle with snapshot (recommended)
   * ✅ Now async to properly await add/remove
   */
  const toggleWithSnapshot = useCallback(async (programData: {
    program_id: string;
    program_name?: string;
    program_name_ar?: string;
    program_slug?: string;
    university_name?: string;
    university_name_ar?: string;
    university_logo?: string;
    country_name?: string;
    country_name_ar?: string;
    country_code?: string;
    country_slug?: string;
    degree_name?: string;
    degree_slug?: string;
    language?: string;
    duration_months?: number | null;
    fees_yearly?: number | null;
    tuition_usd_min?: number | null;
    tuition_usd_max?: number | null;
    city?: string | null;
  }) => {
    // ✅ PATCH 1.2: Use normalized comparison
    const normalizedId = getId(programData.program_id);
    if (shortlist.some(id => getId(id) === normalizedId)) {
      await remove(programData.program_id);
    } else {
      await addWithSnapshot(programData);
    }
  }, [shortlist, addWithSnapshot, remove]);

  /**
   * Legacy toggle (ID only)
   * ✅ Now async to properly await add/remove
   * @deprecated Use toggleWithSnapshot instead
   */
  const toggle = useCallback(async (programId: string) => {
    // ✅ PATCH 1.2: Use normalized comparison
    const normalizedId = getId(programId);
    if (shortlist.some(id => getId(id) === normalizedId)) {
      await remove(programId);
    } else {
      await add(programId);
    }
  }, [shortlist, add, remove]);

  const isFavorite = useCallback((programId: string) => {
    // ✅ PATCH 1.2: Use normalized comparison
    const normalizedId = getId(programId);
    return shortlist.some(id => getId(id) === normalizedId);
  }, [shortlist]);

  return {
    shortlist,
    count: shortlist.length,
    maxCount: MAX_SHORTLIST,
    // V3 methods (with snapshot)
    addWithSnapshot,
    toggleWithSnapshot,
    // Legacy methods (ID only)
    add,
    remove,
    toggle,
    isFavorite,
    syncToCRM,
    // ✅ Cache access
    getSnapshot: (id: string) => snapshotCache.get(id),
  };
}
