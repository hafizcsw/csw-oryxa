import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Heart, RefreshCw, AlertCircle, Play, Loader2, Trash2, X, Globe, Building2, ChevronRight, GraduationCap, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useShortlist } from "@/hooks/useShortlist";
import { useMalakChat } from "@/contexts/MalakChatContext";
import { syncShortlistWithSnapshots, clearShortlist } from "@/lib/portalApi";
import { buildProgramSnapshot, type ProgramSnapshot } from "@/types/shortlist";
import { getSnapshotFromCache, useUnifiedShortlist, getUnifiedProgramId } from "@/hooks/useUnifiedShortlist";
import { useUniversityShortlistHook } from "@/hooks/useUniversityShortlist";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { TabNavigation } from "./TabNavigation";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { getContinent, getContinentName } from "@/lib/continentMapping";
import { HeartButton } from "@/components/shortlist/HeartButton";
// LocalStorage cache key for snapshots
const SNAPSHOT_CACHE_KEY = 'shortlist_snapshot_cache_v1';

// Helper: Get cached snapshots from localStorage
function getLocalStorageCache(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOT_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

// Helper: Save snapshots to localStorage cache
function setLocalStorageCache(cache: Record<string, any>) {
  try {
    localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[ShortlistTab] Failed to save cache:', e);
  }
}

// ✅ PATCH 2.1: Unified ID getter - use this for ALL ID comparisons
// This ensures program_id vs program_ref_id mismatches don't cause resurrection
const getId = (v: any): string => 
  String(v?.program_id || v?.program_ref_id || v?.id || '');

// Helper: Convert any data source to unified display format
// ✅ P0 Fix V4: CRM-First pattern - catalog only enhances, never replaces
// ✅ i18n: Use language-aware field selection
function toDisplayItem(data: any, source: 'remote' | 'hydrated' | 'cache' | 'partial', language?: string): any {
  // ✅ P0: Support both snapshot formats (program_snapshot from CRM, snapshot from local)
  const snap = data?.snapshot || data?.program_snapshot || data;
  
  // ✅ PATCH 2.1: Use unified getId for consistent ID extraction
  const pid = getId(data) || getId(snap);
  
  // ✅ i18n: Language-aware field selection (default to English)
  const lng = language || 'en';
  const arField = (obj: any, base: string) => obj?.[`${base}_ar`];
  const enField = (obj: any, base: string) => obj?.[`${base}_en`];
  const lngField = (obj: any, base: string) => obj?.[`${base}_${lng}`];
  
  // ✅ P0: Complete program name fallback chain (language-aware)
  const programName = 
    lngField(data, 'program_name') ||           // Current language first
    lngField(snap, 'program_name') ||
    data?.program_name ||                       // Remote sends directly
    (lng === 'ar' ? arField(data, 'program_name') : enField(data, 'program_name')) ||
    (lng === 'ar' ? arField(snap, 'program_name') : enField(snap, 'program_name')) ||
    snap?.program_name ||                       // Some formats use program_name
    snap?.name ||                               // Some formats use just "name"
    (source === 'partial' && pid ? `Program ${pid.slice(0, 8)}...` : null);
  
  // ✅ P0: Complete university name fallback chain (language-aware)
  const universityName = 
    lngField(data, 'university_name') ||        // Current language first
    lngField(snap, 'university_name') ||
    data?.university_name ||                    // Remote sends directly
    (lng === 'ar' ? arField(data, 'university_name') : enField(data, 'university_name')) ||
    (lng === 'ar' ? arField(snap, 'university_name') : enField(snap, 'university_name')) ||
    snap?.university_name ||                    // Some formats use university_name
    snap?.university ||                         // Some formats use just "university"
    null;
  
  // ✅ P0: Country resolution (language-aware)
  const countryName = 
    lngField(data, 'country_name') ||
    lngField(snap, 'country_name') ||
    data?.country_name ||
    (lng === 'ar' ? arField(data, 'country_name') : enField(data, 'country_name')) ||
    (lng === 'ar' ? arField(snap, 'country_name') : enField(snap, 'country_name')) ||
    snap?.country_name ||
    data?.country ||
    snap?.country ||
    null;
  
  const countryCode = 
    data?.country_code ||
    data?.country_slug ||
    snap?.country_code ||
    snap?.country_slug ||
    null;
  
  return {
    program_id: pid,                            // ✅ REQUIRED: Must always have program_id
    program_ref_id: data?.program_ref_id || snap?.program_ref_id || pid, // Keep for reference
    program_name: programName,
    university_name: universityName,
    country_name: countryName,
    country_code: countryCode,
    fees_yearly: data?.fees_yearly || data?.tuition_usd_min || snap?.tuition_usd_min || snap?.tuition_usd_yearly || snap?.fees_yearly || null,
    duration_months: data?.duration_months || snap?.duration_months || null,
    portal_url: data?.portal_url || snap?.portal_url || null,
    status: data?.status || null,
    created_at: data?.created_at || null,
    source,
  };
}

// ✅ P0 Fix V4: Merge CRM base with catalog enhancement (catalog never overwrites valid CRM data)
function mergeWithCatalogEnhancement(crmItem: any, catalogItem: any): any {
  // If no catalog data, return CRM as-is
  if (!catalogItem) return crmItem;
  
  // ✅ CRM is base - catalog only fills gaps, never replaces valid data
  return {
    ...crmItem,
    // Only use catalog values if CRM value is missing/empty
    program_name: crmItem.program_name || catalogItem.program_name,
    university_name: crmItem.university_name || catalogItem.university_name,
    country_name: crmItem.country_name || catalogItem.country_name,
    country_code: crmItem.country_code || catalogItem.country_code,
    fees_yearly: crmItem.fees_yearly ?? catalogItem.fees_yearly,
    duration_months: crmItem.duration_months ?? catalogItem.duration_months,
    portal_url: crmItem.portal_url || catalogItem.portal_url,
    // Keep CRM source marker for debugging
    source: crmItem.source,
    _enhanced_by_catalog: !!catalogItem,
  };
}

// ✅ P1 Fix V2: Snapshot validation helper (supports both program_id and program_ref_id)
function isValidProgramSnapshot(snapshot: ProgramSnapshot | null | undefined): boolean {
  if (!snapshot?.snapshot) return false;
  const s = snapshot.snapshot;
  const hasName = !!(s.program_name_en || s.program_name_ar);
  const hasUni = !!(s.university_name_en || s.university_name_ar);
  const hasUrl = !!s.portal_url;
  // ✅ P1 Fix V2: Accept EITHER program_ref_id OR program_id
  const hasId = !!(snapshot.program_ref_id || (snapshot as any).program_id);
  return hasName && hasUni && hasUrl && hasId;
}

// ✅ Helper: Hydrate IDs to Snapshots (cache-first + fetch missing)
async function hydrateIdsToSnapshots(programIds: string[]): Promise<ProgramSnapshot[]> {
  const unique = Array.from(new Set(programIds)).filter(Boolean);
  if (unique.length === 0) return [];

  // 1) Take from cache first
  const cached: ProgramSnapshot[] = [];
  const missing: string[] = [];

  for (const id of unique) {
    const s = getSnapshotFromCache(id);
    if (s) {
      cached.push(s);
    } else {
      missing.push(id);
    }
  }

  console.log('[PORTAL:SHORTLIST:Hydrate] Cache hit:', cached.length, 'Missing:', missing.length);

  // 2) Fetch missing from Portal KB
  let fetched: ProgramSnapshot[] = [];
  if (missing.length > 0) {
    const { data, error } = await supabase
      .from('vw_program_search')
      .select(`
        program_id, program_name, description,
        university_name, logo_url, city,
        country_name, country_slug,
        degree_name, degree_slug,
        tuition_usd_min, tuition_usd_max, duration_months, languages
      `)
      .in('program_id', missing);

    if (!error && data?.length) {
      fetched = data.map(p => buildProgramSnapshot({
        program_id: p.program_id,
        program_name: p.program_name,
        university_name: p.university_name,
        university_logo: p.logo_url,
        country_name: p.country_name,
        country_slug: p.country_slug,
        degree_name: p.degree_name,
        degree_slug: p.degree_slug,
        duration_months: p.duration_months,
        fees_yearly: p.tuition_usd_min,
        language: Array.isArray(p.languages) ? p.languages[0] : p.languages,
        city: p.city,
      }));
    } else if (error) {
      console.warn('[PORTAL:SHORTLIST:Hydrate] DB fetch failed:', error);
    }
  }

  // 3) ✅ P0 Fix: Relax filter - accept portal_url only
  const snapshots = [...cached, ...fetched]
    .filter(s => s?.snapshot?.portal_url)
    .map(s => ({
      ...s,
      snapshot: {
        ...s.snapshot,
        // Ensure at least one name is present
        program_name_en: s.snapshot?.program_name_en || s.snapshot?.program_name_ar || null,
        university_name_en: s.snapshot?.university_name_en || s.snapshot?.university_name_ar || null,
      }
    }));

  // 4) Log skipped IDs (won't be sent to CRM)
  const hydratedIds = new Set(snapshots.map(s => s.program_ref_id));
  const stillMissing = unique.filter(id => !hydratedIds.has(id));
  if (stillMissing.length) {
    console.warn('[PORTAL:SHORTLIST:Hydrate] Skipped (not in catalog):', stillMissing);
  }

  return snapshots;
}

interface ShortlistTabProps {
  onTabChange?: (tab: string) => void;
  onStartProgram?: (programId: string, countryCode?: string) => void;
}

export function ShortlistTab({ onTabChange, onStartProgram }: ShortlistTabProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, language } = useLanguage();
  // ✅ P0 Fix: Use clearLocalShortlist for single-operation clear
  const { shortlist: localShortlist, removeFromShortlist, clearLocalShortlist } = useMalakChat();
  const { shortlist: remoteShortlist, loading, error_code, refetch, error } = useShortlist();
  // ✅ P0 FIX: Use unified shortlist for delta remove
  const { remove: deltaRemoveProgram } = useUnifiedShortlist();
  const { items: uniShortlistItems, isLoading: uniLoading, remove: removeUni } = useUniversityShortlistHook();
  const lastSyncHashRef = useRef<string>("");
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  
  // ✅ Handle refresh with visual feedback
  const handleRefresh = async () => {
    if (isRefreshing || loading) return;
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success(t('portal.shortlist.updatedSuccess'));
    } catch (err) {
      console.error('[ShortlistTab] Refresh error:', err);
      toast.error(t('portal.shortlist.updateFailed'));
    } finally {
      setIsRefreshing(false);
    }
  };

  // ✅ PORTAL-4: Handle individual program removal via Edge Function (Server-First)
  // The hook now handles the server-first pattern internally
  const handleRemoveProgram = async (programId: string) => {
    if (removingId) return; // Prevent double-clicks
    setRemovingId(programId);
    
    console.log('[ShortlistTab] 🗑️ Removing program (SERVER-FIRST):', programId);
    
    try {
      // ✅ PORTAL-4: deltaRemoveProgram now waits for server confirmation
      // before removing from local state - no optimistic update
      const result = await deltaRemoveProgram(programId);
      
      if (result?.ok) {
        // ✅ Server confirmed - refetch to sync UI (both query keys)
        qc.invalidateQueries({ queryKey: ['shortlist'] });
        qc.invalidateQueries({ queryKey: ['portal-shortlist'] });
        qc.invalidateQueries({ queryKey: ['uni-shortlist'] });
        await refetch();
        console.log('[ShortlistTab] ✅ Program removed successfully:', programId);
      } else {
        // ❌ Server failed - toast already shown by hook
        console.error('[ShortlistTab] ❌ Remove failed on server:', result?.error);
      }
    } catch (err) {
      console.error('[ShortlistTab] ❌ Remove exception:', err);
      toast.error(t('portal.shortlist.unexpectedError'));
    } finally {
      setRemovingId(null);
    }
  };

  const [hydratedPrograms, setHydratedPrograms] = useState<any[]>([]);
  const [isHydrating, setIsHydrating] = useState(false);
  
  // ✅ P0-B: Track if user is logged in (session exists)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [waitingForRemote, setWaitingForRemote] = useState(true);
  
  // ✅ P0 FIX: Keep last valid display to prevent "Unknown" flicker
  const lastValidDisplayRef = useRef<any[]>([]);
  const snapshotCacheRef = useRef<Record<string, any>>(getLocalStorageCache());
  const hydrationKeyRef = useRef<string>("");

  // ✅ P0 Fix V3: Clear all shortlist - SERVER-FIRST approach
  // Order: 1) Call server, 2) Only clear local on success, 3) Preserve cache on failure
  const handleClearAll = async () => {
    if (isClearing) return;
    setIsClearing(true);
    
    const requestId = `clear_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log('[ShortlistTab] 🗑️ Starting clear all, request_id:', requestId);
    
    // ✅ Store current IDs hash for lastValidDisplay invalidation
    const currentIdsHash = [...localShortlist].sort().join(',');
    
    try {
      // ✅ Step 1: Call server FIRST (don't clear local until confirmed)
      const result = await clearShortlist();
      
      console.log('[ShortlistTab] 📥 clearShortlist response:', result, 'request_id:', requestId);
      
      if (result.ok) {
        // ✅ Step 2: SUCCESS - Now safe to clear ALL local state
        clearLocalShortlist();
        setHydratedPrograms([]);
        lastSyncHashRef.current = '';
        hydrationKeyRef.current = '';
        
        // ✅ Clear lastValidDisplayRef ONLY if IDs match (prevents stale data return)
        lastValidDisplayRef.current = [];
        
        // ✅ Clear localStorage caches
        localStorage.removeItem('shortlist_snapshot_cache_v1');
        snapshotCacheRef.current = {};
        
        toast.success(t('portal.shortlist.clearSuccess'));
        
        // Invalidate and refetch to confirm empty state
        qc.invalidateQueries({ queryKey: ['shortlist'] });
        refetch();
      } else {
        // ✅ Step 2b: FAILURE - Do NOT clear local state, preserve snapshot cache as safety net
        console.warn('[ShortlistTab] ⚠️ Server clear failed, preserving local state:', result);
        toast.error(t('portal.shortlist.clearFailed'));
      }
    } catch (err) {
      // ✅ ERROR - Do NOT clear local state
      console.error('[ShortlistTab] ❌ Clear all exception:', err, 'request_id:', requestId);
      toast.error(t('portal.shortlist.clearError'));
    } finally {
      setIsClearing(false);
    }
  };

  // ✅ P0-B: Check session status on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkSession();
  }, []);

  // ✅ P0-B: Mark waitingForRemote=false once remote query completes (success or empty)
  useEffect(() => {
    if (!loading && isLoggedIn !== null) {
      // Remote query finished - stop waiting
      setWaitingForRemote(false);
    }
  }, [loading, isLoggedIn]);

  // ✅ Hydration effect: Load program details when remote is empty
  // P0-B FIX: Only hydrate if NOT logged in OR if remote already completed
  useEffect(() => {
    let cancelled = false;

    const hydrateLocal = async () => {
      // ✅ P0-B: If logged in and still waiting for remote, don't show local yet
      if (isLoggedIn === true && waitingForRemote) {
        console.log('[ShortlistTab] ⏸️ Logged in, waiting for remote before showing local');
        return;
      }

      // Create stable key for this hydration request
      const localIds = localShortlist?.length ? [...localShortlist].sort().join(',') : '';
      const remoteCount = remoteShortlist?.length || 0;
      const hydrationKey = `${localIds}|${remoteCount}`;
      
      // Skip if same request already processed
      if (hydrationKeyRef.current === hydrationKey && hydratedPrograms.length > 0) {
        console.log('[ShortlistTab] ⏭️ Skipping duplicate hydration:', hydrationKey);
        return;
      }

      if (!localShortlist?.length) {
        setHydratedPrograms([]);
        hydrationKeyRef.current = hydrationKey;
        return;
      }

      // ✅ P0 Fix: إذا الـ remote عنده بيانات فعلية فقط -> نوقف hydration
      // ❌ لا تمسح hydratedPrograms هنا إطلاقًا
      if (Array.isArray(remoteShortlist) && remoteShortlist.length > 0) {
        console.log('[ShortlistTab] ⏭️ Remote has data, skipping hydration');
        hydrationKeyRef.current = hydrationKey;
        return;
      }

      setIsHydrating(true);
      console.log('[ShortlistTab] 🔄 Starting hydration for:', localShortlist.length, 'items');

      try {
        // 1) Check ref cache first (avoids setState loop)
        const currentCache = snapshotCacheRef.current;
        const fromCache: any[] = [];
        const missingIds: string[] = [];

        // ✅ P1 Fix: Validate cached snapshots before using
        localShortlist.forEach((id: string) => {
          const cached = currentCache[id];
          if (cached && isValidProgramSnapshot(cached)) {
            fromCache.push(toDisplayItem(cached, 'cache', language));
          } else {
            // ✅ P1: Even if in cache but invalid → treat as missing
            if (cached) {
              console.warn('[ShortlistTab] ⚠️ Invalid cached snapshot, will refetch:', id);
            }
            missingIds.push(id);
          }
        });

        console.log('[ShortlistTab] Cache hit:', fromCache.length, 'Missing:', missingIds.length);

        // 2) If all cached, display immediately
        if (missingIds.length === 0) {
          if (!cancelled) {
            setHydratedPrograms(fromCache);
            hydrationKeyRef.current = hydrationKey;
          }
          return;
        }

        // 3) Hydrate missing from catalog
        const snapshots = await hydrateIdsToSnapshots(missingIds);

        // 4) Update ref cache (no state update = no re-render loop)
        snapshots.forEach((snap) => {
          const pid = snap.program_ref_id;
          if (pid) snapshotCacheRef.current[pid] = snap;
        });
        
        // Persist to localStorage once
        setLocalStorageCache(snapshotCacheRef.current);

        if (!cancelled) {
          // 5) Build display items in original order
          const items = localShortlist.map((id: string) => {
            const snap = snapshotCacheRef.current[id];
            if (snap) return toDisplayItem(snap, 'hydrated', language);
            // ✅ P0 Fix: Better fallback - show partial ID instead of null
            return toDisplayItem({ program_id: id }, 'partial', language);
          });
          setHydratedPrograms(items);
          hydrationKeyRef.current = hydrationKey;
        }
      } catch (e) {
        console.error('[ShortlistTab] Hydration failed:', e);
        if (!cancelled) {
          // ✅ P0 Fix: Better fallback on error
          setHydratedPrograms(
            localShortlist.map((id: string) => toDisplayItem({ program_id: id }, 'partial', language))
          );
          hydrationKeyRef.current = hydrationKey;
        }
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    };

    if (!loading) hydrateLocal();

    return () => { cancelled = true; };
  }, [loading, localShortlist, remoteShortlist, isLoggedIn, waitingForRemote]);

  // ✅ P0 FIX: Auto-reconcile DISABLED to prevent flicker
  // Full-sync was causing favorites to disappear after add/remove
  // Now using delta RPCs (shortlist_add/shortlist_remove) via useUnifiedShortlist
  // Manual reconcile available via handleManualReconcile button if needed
  
  const handleManualReconcile = useCallback(async () => {
    // Guard: local is empty
    if (localShortlist.length === 0) {
      toast.info(t('portal.shortlist.noFavoritesToSync'));
      return;
    }
    
    // Check for session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error(t('portal.shortlist.loginRequired'));
      return;
    }
    
    console.log('[PORTAL:SHORTLIST:ManualReconcile] Starting V3 sync:', localShortlist.length, 'items');
    
    try {
      // ✅ V3: Hydrate IDs to snapshots before sync
      const snapshots = await hydrateIdsToSnapshots(localShortlist);
      
      if (snapshots.length === 0) {
        console.warn('[PORTAL:SHORTLIST:ManualReconcile] No valid snapshots to sync');
        toast.error(t('portal.shortlist.noSyncData'));
        return;
      }
      
      console.log('[PORTAL:SHORTLIST:ManualReconcile] Sending V3 snapshots:', snapshots.length);
      
      const result = await syncShortlistWithSnapshots(snapshots, 'portal_shortlist_manual_reconcile');
      
      if (result?.ok !== false) {
        console.log('[PORTAL:SHORTLIST:ManualReconcile] Success:', {
          synced: result.synced_to_crm,
          stored: result.stored_count,
          rejected: result.rejected_items?.length || 0,
        });
        qc.invalidateQueries({ queryKey: ['shortlist'] });
        refetch();
        toast.success(t('portal.shortlist.syncSuccess'));
      } else {
        console.warn('[PORTAL:SHORTLIST:ManualReconcile] Failed:', result);
        toast.error(t('portal.shortlist.syncFailed'));
      }
    } catch (err) {
      console.warn('[PORTAL:SHORTLIST:ManualReconcile] Error:', err);
      toast.error(t('portal.shortlist.syncError'));
    }
  }, [localShortlist, qc, refetch]);

  // Handle auth_required redirect in useEffect (not during render)
  useEffect(() => {
    if (error_code === 'auth_required') {
      navigate('/');
    }
  }, [error_code, navigate]);

  // ✅ P0 Fix: Remote takes priority ONLY if it has actual data
  const hasRemoteData = Array.isArray(remoteShortlist) && remoteShortlist.length > 0;
  const hasLocalData = localShortlist.length > 0;
  const isShowingLocalFallback = !hasRemoteData && hasLocalData;
  
  // ✅ P0 Safety Guard: Build fallback display from cache/hydrated
  const cacheOrHydratedDisplay = useMemo(() => {
    // Hydrated first (has full details)
    if (hydratedPrograms.length > 0) {
      return hydratedPrograms;
    }
    // Then cache
    if (localShortlist?.length) {
      const fromCache = localShortlist
        .map((id: string) => {
          const snap = snapshotCacheRef.current?.[id];
          return snap ? toDisplayItem(snap, 'cache', language) : null;
        })
        .filter(Boolean) as any[];
      if (fromCache.length > 0) return fromCache;
    }
    // Partial fallback
    if (localShortlist?.length) {
      return localShortlist.map((id: string) => ({
        program_id: id,
        program_name: `${t('common.program')} ${id.slice(0, 8)}...`,
        university_name: '',
        country_name: '',
        source: 'id_only' as const,
      }));
    }
    return [];
  }, [hydratedPrograms, localShortlist]);

  const displayShortlist = useMemo(() => {
    // ✅ PORTAL-Q1: Diagnostic log for shortlist decision
    console.log('[PORTAL:SHORTLIST:DECISION]', {
      timestamp: new Date().toISOString(),
      hasRemoteData,
      remoteLen: remoteShortlist?.length ?? 0,
      cacheLen: cacheOrHydratedDisplay?.length ?? 0,
      lastValidLen: lastValidDisplayRef.current?.length ?? 0,
      remoteSample: remoteShortlist?.[0] ? {
        id: remoteShortlist[0]?.program_ref_id || remoteShortlist[0]?.program_id,
        name: remoteShortlist[0]?.program_name || remoteShortlist[0]?.snapshot?.program_name_en,
      } : null,
    });
    
    // ✅ P0 PATCH 2: CRM is the ABSOLUTE source of truth
    // If we have remote data (even empty), it's authoritative
    // Only use fallback if remote call completely failed (loading or error)
    
    // Case 1: Still loading - show lastValid to prevent flicker
    if (loading) {
      if (lastValidDisplayRef.current.length > 0) {
        console.log('[ShortlistTab:Display] Loading, showing lastValid:', lastValidDisplayRef.current.length);
        return lastValidDisplayRef.current;
      }
      return [];
    }
    
    // Case 2: CRM returned data (even if empty array) - this is authoritative
    if (Array.isArray(remoteShortlist)) {
      // ✅ PATCH 2.1: Build remote IDs set using unified getId
      const remoteIds = new Set(remoteShortlist.map((r: any) => getId(r)).filter(Boolean));
      
      // ✅ PATCH 2.1 DBG: Log for debugging ID mismatch issues
      console.log('[DBG_IDS]', {
        remoteIds: Array.from(remoteIds).slice(0, 5),
        lastValidIds: lastValidDisplayRef.current.map(getId).slice(0, 5),
      });
      
      // ✅ CRITICAL: Filter lastValidDisplayRef using unified getId
      // This prevents deleted items from being resurrected due to ID mismatch
      lastValidDisplayRef.current = lastValidDisplayRef.current.filter(
        (x: any) => remoteIds.has(getId(x))
      );
      
      // If CRM is empty, return empty (don't fall back to cache)
      if (remoteShortlist.length === 0) {
        console.log('[ShortlistTab:Display] CRM returned empty - clearing display');
        lastValidDisplayRef.current = [];
        return [];
      }
      
      // Build display from remote with catalog enhancement
      const remoteDisplay = remoteShortlist.map((r: any) => {
        const crmItem = toDisplayItem(r, 'remote', language);
        
        // ✅ PATCH 2.1: Use unified getId for catalog matching
        const catalogMatch = cacheOrHydratedDisplay.find(
          (c: any) => getId(c) === getId(crmItem)
        );
        
        // Merge: CRM is base, catalog only fills gaps
        return mergeWithCatalogEnhancement(crmItem, catalogMatch);
      });
      
      // ✅ P0 Evidence Log
      console.log('[ShortlistTab:Display:CRM_AUTHORITATIVE]', {
        remote_count: remoteDisplay.length,
        enhanced_count: remoteDisplay.filter((x: any) => x._enhanced_by_catalog).length,
      });

      // Check if remote has valid names (≥50% threshold)
      const validNames = remoteDisplay.filter(
        (x: any) => !!x?.program_name && 
                    x.program_name !== 'برنامج غير معروف' && 
                    !x.program_name.startsWith('برنامج ')
      );
      const remoteHasValidNames = remoteDisplay.length > 0 && 
        (validNames.length / remoteDisplay.length) >= 0.5;

      // Use remote if it passes the guard
      if (remoteHasValidNames) {
        console.log('[ShortlistTab:Display] Using CRM data:', remoteDisplay.length);
        lastValidDisplayRef.current = remoteDisplay;
        return remoteDisplay;
      }
      
      // ✅ Remote has data but names are bad - still use it but enhance with cache
      // DON'T fall back to lastValid which might have deleted items
      console.log('[ShortlistTab:Display] CRM names incomplete, using as-is:', remoteDisplay.length);
      lastValidDisplayRef.current = remoteDisplay;
      return remoteDisplay;
    }
    
    // Case 3: Remote query failed completely (not just empty) - use fallback
    console.log('[ShortlistTab:Display] Remote failed, using fallback');
    if (cacheOrHydratedDisplay.length > 0) {
      lastValidDisplayRef.current = cacheOrHydratedDisplay;
      return cacheOrHydratedDisplay;
    }
    if (lastValidDisplayRef.current.length > 0) {
      return lastValidDisplayRef.current;
    }
    return [];
  }, [loading, remoteShortlist, cacheOrHydratedDisplay, hasRemoteData]);

  // ✅ P0 Evidence Log: ShortlistTab open
  console.log('[PORTAL:SHORTLIST:TAB_OPEN]', {
    localShortlist_count: localShortlist.length,
    localShortlist_ids: localShortlist,
    remoteShortlist_count: remoteShortlist.length,
    hydratedPrograms_count: hydratedPrograms.length,
    displayShortlist_count: displayShortlist.length,
    snapshotCache_size: Object.keys(snapshotCacheRef.current).length,
    source: hasRemoteData ? 'remote' : (hydratedPrograms.length > 0 ? 'hydrated' : 'none'),
    missingIds: localShortlist.filter((id: string) => !snapshotCacheRef.current[id]),
  });

  // ✅ P0-B: For logged-in users, show loading until remote query completes
  // This prevents showing local data that will be replaced by remote
  const showLoadingState = loading || isHydrating || (isLoggedIn === true && waitingForRemote);
  
  if (showLoadingState) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-muted/30 rounded-xl h-24" />
        ))}
      </div>
    );
  }

  // Handle error codes - but still show local items if available
  if (error_code === 'no_linked_customer') {
    return (
      <div className="space-y-6">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="w-5 h-5" />
            <span>{t('portal.shortlist.accountNotLinked')} - {t('portal.shortlist.talkToMalak')}</span>
          </div>
        </div>
        
        {/* Still show local shortlist items */}
        {hasLocalData && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <div>
                  <h2 className="text-xl font-bold text-foreground">{t('portal.shortlist.localPrograms')}</h2>
                  <p className="text-sm text-muted-foreground">{t('portal.shortlist.detailsAfterLink')}</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="space-y-3">
                {localShortlist.map((programId) => (
                  <div
                    key={programId}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Heart className="h-5 w-5 text-primary fill-primary" />
                      <p className="font-medium text-foreground">
                        {t('portal.shortlist.program')} #{programId.slice(0, 8)}
                      </p>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onStartProgram?.(programId)}
                      className="gap-1.5 text-xs"
                    >
                      <Play className="h-3 w-3" />
                      {t('portal.shortlist.startProgram')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/')} 
          className="gap-2"
        >
          {t('portal.shortlist.talkToMalak')}
        </Button>
      </div>
    );
  }

  if (error_code === 'auth_required') {
    return null; // useEffect handles the redirect
  }

  return (
    <div className="space-y-6">
      {/* Sync in progress indicator */}
      {isShowingLocalFallback && (
        <Alert className="bg-info/10 border-info/30">
          <Loader2 className="h-4 w-4 animate-spin text-info" />
          <AlertDescription className="text-info">
            {t('portal.shortlist.syncing')}
          </AlertDescription>
        </Alert>
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('portal.shortlist.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('portal.shortlist.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/universities?tab=programs')} className="gap-2">
            <Heart className="h-4 w-4" />
            {t('portal.shortlist.browsePrograms')}
          </Button>
          {displayShortlist.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll} disabled={isClearing} className="gap-2 text-destructive hover:bg-destructive/10">
              {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t('portal.shortlist.clearAll')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing || loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? t('portal.shortlist.refreshing') : t('portal.shortlist.refresh')}
          </Button>
        </div>
      </div>

      {/* Content - Hierarchical Display */}
      <div className="bg-card rounded-xl border border-border p-6">
        {error ? (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 text-destructive/50 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('portal.shortlist.loadFailed')}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('portal.shortlist.retry')}
            </Button>
          </div>
        ) : (displayShortlist.length === 0 && uniShortlistItems.length === 0) ? (
          <div className="text-center py-8">
            <Heart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('portal.shortlist.empty')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('portal.shortlist.emptyDesc')}</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/universities?tab=programs')} className="mt-4">
              {t('portal.shortlist.searchPrograms')}
            </Button>
          </div>
        ) : (
          <HierarchicalShortlistView
            programs={displayShortlist}
            uniShortlistItems={uniShortlistItems}
            language={language}
            t={t}
            onStartProgram={onStartProgram}
            onRemoveProgram={handleRemoveProgram}
            removingId={removingId}
            onRemoveUni={async (uniId: string) => {
              await removeUni(uniId);
            }}
          />
        )}
      </div>

      {/* Stats */}
      {(displayShortlist.length > 0 || uniShortlistItems.length > 0) && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <div className="text-3xl font-bold text-primary mb-1">{displayShortlist.length}</div>
            <div className="text-sm text-muted-foreground">{t('portal.shortlist.programsCount')}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <div className="text-3xl font-bold text-accent mb-1">{uniShortlistItems.length}</div>
            <div className="text-sm text-muted-foreground">{t('portal.shortlist.favoriteUniversities')}</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <div className="text-3xl font-bold text-success mb-1">
              {displayShortlist.filter((i: any) => i.status === 'applied').length}
            </div>
            <div className="text-sm text-muted-foreground">{t('portal.shortlist.applied')}</div>
          </div>
        </div>
      )}

      {onTabChange && <TabNavigation currentTab="shortlist" onTabChange={onTabChange} />}
    </div>
  );
}

// ============= Hierarchical View Component =============
interface HierarchicalProps {
  programs: any[];
  uniShortlistItems: Array<{ university_id: string; created_at: string }>;
  language: string;
  t: (key: string) => string;
  onStartProgram?: (programId: string, countryCode?: string) => void;
  onRemoveProgram: (programId: string) => void;
  removingId: string | null;
  onRemoveUni: (uniId: string) => void;
}

function HierarchicalShortlistView({
  programs, uniShortlistItems, language, t, onStartProgram, onRemoveProgram, removingId, onRemoveUni
}: HierarchicalProps) {
  const navigate = useNavigate();
  const localePrefix = language === 'ar' ? 'ar' : 'en';

  // Fetch university names for shortlisted universities
  const uniIds = useMemo(() => uniShortlistItems.map(u => u.university_id), [uniShortlistItems]);
  
  const { data: uniNames } = useQuery({
    queryKey: ['uni-shortlist-names', ...uniIds],
    queryFn: async () => {
      if (uniIds.length === 0) return {};
      const { data } = await supabase
        .from('universities')
        .select('id, name, name_ar, name_en, country_code, city, logo_url')
        .in('id', uniIds);
      const map: Record<string, { name: string; name_ar?: string; name_en?: string; country_code?: string; city?: string; logo_url?: string }> = {};
      (data || []).forEach((u: any) => { map[u.id] = u; });
      return map;
    },
    enabled: uniIds.length > 0,
    staleTime: 60_000,
  });

  // Build hierarchy: continent → country → university → programs
  const hierarchy = useMemo(() => {
    type UniNode = {
      university_id: string;
      university_name: string;
      logo_url?: string;
      programs: any[];
      isFavoritedUni: boolean;
    };
    type CountryNode = { country_code: string; country_name: string; universities: Record<string, UniNode> };
    type ContinentNode = { continent: string; continentName: string; countries: Record<string, CountryNode> };

    const tree: Record<string, ContinentNode> = {};

    // 1. Group programs by continent → country → university
    for (const prog of programs) {
      const cc = (prog.country_code || '').toUpperCase();
      const continent = getContinent(cc);
      const continentName = getContinentName(continent, language);
      const countryName = prog.country_name || cc || t('portal.shortlist.unknown');
      const uniName = prog.university_name || t('portal.shortlist.unknownUniversity');
      const uniKey = prog.university_id || uniName;

      if (!tree[continent]) tree[continent] = { continent, continentName, countries: {} };
      if (!tree[continent].countries[cc || 'XX']) {
        tree[continent].countries[cc || 'XX'] = { country_code: cc, country_name: countryName, universities: {} };
      }
      if (!tree[continent].countries[cc || 'XX'].universities[uniKey]) {
        tree[continent].countries[cc || 'XX'].universities[uniKey] = {
          university_id: uniKey,
          university_name: uniName,
          logo_url: prog.logo_url,
          programs: [],
          isFavoritedUni: false,
        };
      }
      tree[continent].countries[cc || 'XX'].universities[uniKey].programs.push(prog);
    }

    // 2. Add university-only favorites (not already in tree from programs)
    for (const uni of uniShortlistItems) {
      let found = false;
      for (const cont of Object.values(tree)) {
        for (const country of Object.values(cont.countries)) {
          if (country.universities[uni.university_id]) {
            country.universities[uni.university_id].isFavoritedUni = true;
            found = true;
          }
        }
      }
      if (!found) {
        const uniData = uniNames?.[uni.university_id];
        const cc = uniData?.country_code?.toUpperCase() || '';
        const continent = cc ? getContinent(cc) : 'other';
        const continentName = getContinentName(continent, language);
        const countryKey = cc || 'XX';
        
        // Resolve university name from fetched data
        const resolvedName = uniData 
          ? (language === 'ar' ? (uniData.name_ar || uniData.name) : (uniData.name_en || uniData.name))
          : t('portal.shortlist.favoritedUniversity');

        if (!tree[continent]) tree[continent] = { continent, continentName, countries: {} };
        if (!tree[continent].countries[countryKey]) {
          tree[continent].countries[countryKey] = { country_code: cc, country_name: cc || t('portal.shortlist.unknown'), universities: {} };
        }
        tree[continent].countries[countryKey].universities[uni.university_id] = {
          university_id: uni.university_id,
          university_name: resolvedName,
          logo_url: uniData?.logo_url,
          programs: [],
          isFavoritedUni: true,
        };
      }
    }

    return tree;
  }, [programs, uniShortlistItems, language, uniNames]);

  const continents = Object.values(hierarchy);

  if (continents.length === 0) return null;

  return (
    <div className="space-y-8">
      {continents.map((cont) => (
        <div key={cont.continent} className="space-y-5">
          {/* ── Continent Header ── */}
          <div className="flex items-center gap-3 pb-3 border-b-2 border-primary/30">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{cont.continentName}</h3>
              <p className="text-xs text-muted-foreground">
                {Object.keys(cont.countries).length} {t('portal.shortlist.countries')}
              </p>
            </div>
          </div>

          {Object.values(cont.countries).map((country, countryIdx) => (
            <div key={country.country_code} className="space-y-4">
              {/* ── Country Header ── */}
              <div className="flex items-center gap-2 ps-4">
                <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-accent-foreground" />
                </div>
                <h4 className="text-lg font-semibold text-foreground">{country.country_name}</h4>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {Object.keys(country.universities).length} {t('portal.shortlist.universities')}
                </span>
              </div>

              {/* ── Universities Grid ── */}
              <div className="grid grid-cols-1 gap-4 ps-6">
                {Object.values(country.universities).map((uni) => (
                  <div
                    key={uni.university_id}
                    className="bg-muted/20 rounded-xl border border-border/60 overflow-hidden"
                  >
                    {/* University Header */}
                    <div className="flex items-center justify-between p-4 bg-muted/30 border-b border-border/40">
                      <Link
                        to={`/${localePrefix}/university/${uni.university_id}`}
                        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                      >
                        {uni.logo_url ? (
                          <img
                            src={uni.logo_url}
                            alt=""
                            className="w-10 h-10 rounded-lg object-contain bg-background border border-border/50 p-1"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-foreground truncate">{uni.university_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {uni.programs.length > 0
                              ? `${uni.programs.length} ${t('portal.shortlist.favoritedPrograms')}`
                              : t('portal.shortlist.favoritedUniversity')}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        {uni.isFavoritedUni && (
                          <>
                            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemoveUni(uni.university_id)}
                              className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Programs List */}
                    {uni.programs.length > 0 ? (
                      <div className="divide-y divide-border/30">
                        {uni.programs.map((prog: any) => (
                          <div
                            key={prog.program_id}
                            className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground text-sm leading-tight">
                                  {prog.program_name || t('portal.shortlist.unknownProgram')}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  {prog.fees_yearly && (
                                    <span className="text-primary font-medium">
                                      ${Number(prog.fees_yearly).toLocaleString()}{t('portal.shortlist.perYear')}
                                    </span>
                                  )}
                                  {prog.duration_months && (
                                    <span>{prog.duration_months} {t('portal.shortlist.months')}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/program/${prog.program_id}`)}
                                className="gap-1.5 text-xs h-8"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                                {t('portal.shortlist.details')}
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => onStartProgram?.(prog.program_id, prog.country_code)}
                                className="gap-1.5 text-xs h-8"
                              >
                                <Play className="h-3 w-3" />
                                {t('portal.shortlist.startProgram')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onRemoveProgram(prog.program_id); }}
                                disabled={removingId === prog.program_id}
                                className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                              >
                                {removingId === prog.program_id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* University favorited but no programs */
                      <div className="p-4">
                        <Link
                          to={`/${localePrefix}/university/${uni.university_id}`}
                          className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all text-primary font-semibold text-sm"
                        >
                          <GraduationCap className="h-4 w-4" />
                          {t('portal.shortlist.browseAvailable')}
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Country separator */}
              {countryIdx < Object.values(cont.countries).length - 1 && (
                <div className="border-b border-border/30 ms-4" />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
