/**
 * #7.2 Portal Shortlist Hook
 * Uses the new RPC-based shortlist API with 10-item limit enforcement
 * ✅ FIX: Now fetches program data and builds snapshot on add
 */
import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  shortlistList, 
  shortlistAddNew, 
  shortlistRemoveNew,
  shortlistCompare,
  ShortlistItem,
  ShortlistAddResponse,
  ShortlistCompareItem,
} from '@/lib/portalApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Session } from '@supabase/supabase-js';

const SHORTLIST_QUERY_KEY = ['portal-shortlist'];
const SHORTLIST_COMPARE_KEY = ['portal-shortlist-compare'];

/**
 * Fetch program snapshot data from catalog view
 */
async function fetchProgramSnapshot(programId: string): Promise<Record<string, unknown> | undefined> {
  try {
    const { data, error } = await supabase
      .from('vw_program_search_api_v3_final' as any)
      .select('program_id, program_name_ar, program_name_en, university_name_ar, university_name_en, university_logo_url, country_name_ar, country_name_en, country_code, degree_name, degree_slug, discipline_slug, discipline_name_ar, discipline_name_en, duration_months, tuition_usd_year_max, tuition_usd_year_min, instruction_languages, city')
      .eq('program_id', programId)
      .maybeSingle();

    if (error || !data) {
      console.warn('[usePortalShortlist] ⚠️ Could not fetch program snapshot:', error?.message || 'not found');
      return undefined;
    }

    const d = data as any;
    const snapshot: Record<string, unknown> = {
      program_name_en: d.program_name_en || null,
      program_name_ar: d.program_name_ar || null,
      university_name_en: d.university_name_en || null,
      university_name_ar: d.university_name_ar || null,
      university_logo: d.university_logo_url || null,
      country_name_en: d.country_name_en || null,
      country_name_ar: d.country_name_ar || null,
      country_code: d.country_code || null,
      degree_level: d.degree_name || d.degree_slug || null,
      language: Array.isArray(d.instruction_languages) ? d.instruction_languages[0] : null,
      duration_months: d.duration_months || null,
      tuition_usd_min: d.tuition_usd_year_min || null,
      tuition_usd_max: d.tuition_usd_year_max || null,
      discipline_slug: d.discipline_slug || null,
      discipline_name_ar: d.discipline_name_ar || null,
      discipline_name_en: d.discipline_name_en || null,
      city: d.city || null,
      portal_url: `${typeof window !== 'undefined' ? window.location.origin : ''}/program/${programId}`,
    };

    console.log('[usePortalShortlist] ✅ Built snapshot for:', programId, {
      name: snapshot.program_name_en || snapshot.program_name_ar,
      uni: snapshot.university_name_en || snapshot.university_name_ar,
    });

    return snapshot;
  } catch (e) {
    console.warn('[usePortalShortlist] ⚠️ Snapshot fetch error:', e);
    return undefined;
  }
}

export function usePortalShortlist() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Auth status (robust):
  // - subscribe FIRST
  // - then getSession
  // - treat auth as "ready" only after initial getSession resolves
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAuthenticated = !!session?.access_token;

  // Fetch shortlist
  const { 
    data: listData, 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: SHORTLIST_QUERY_KEY,
    queryFn: shortlistList,
    // ✅ FIX A: Guest = zero network calls
    enabled: authReady && !!session?.access_token,
    staleTime: 10_000, // 10 seconds
    refetchOnWindowFocus: true,
  });

  const items: ShortlistItem[] = listData?.items ?? [];
  const count = listData?.count ?? 0;
  const limit = listData?.limit ?? 10;

  // Add mutation - now accepts {programId, snapshot}
  const addMutation = useMutation({
    mutationFn: ({ programId, snapshot }: { programId: string; snapshot?: Record<string, unknown> }) => 
      shortlistAddNew(programId, snapshot, 'portal'),
    onSuccess: (res) => {
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: SHORTLIST_QUERY_KEY });
      }
    },
  });

  // Remove mutation
  const removeMutation = useMutation({
    mutationFn: (programId: string) => shortlistRemoveNew(programId),
    onSuccess: (res) => {
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: SHORTLIST_QUERY_KEY });
      }
    },
  });

  // Add program — now fetches snapshot from catalog before sending
  const add = useCallback(async (programId: string): Promise<ShortlistAddResponse> => {
    if (!session?.access_token) {
      return { 
        ok: false, 
        error_code: 'not_authenticated', 
        count: 0, 
        limit: 10, 
        limit_reached: false 
      };
    }

    // ✅ FIX: Fetch program data and build snapshot
    const snapshot = await fetchProgramSnapshot(programId);
    
    console.log('[usePortalShortlist] 📤 Adding with snapshot:', {
      program_id: programId,
      has_snapshot: !!snapshot,
      snapshot_name: snapshot?.program_name_en || snapshot?.program_name_ar || '(none)',
    });

    const res = await addMutation.mutateAsync({ programId, snapshot });
    
    if (res.ok && res.added) {
      toast.success('تمت الإضافة للمفضلة ❤️');
    } else if (!res.ok && res.error_code === 'shortlist_limit_reached') {
      // Don't show toast here - let the UI show the modal
      console.log('[usePortalShortlist] Limit reached, UI should show modal');
    }
    
    return res;
  }, [session?.access_token, addMutation]);

  // Remove program
  const remove = useCallback(async (programId: string) => {
    if (!session?.access_token) {
      return { ok: false, error_code: 'not_authenticated' };
    }

    const res = await removeMutation.mutateAsync(programId);
    
    if (res.ok && res.removed) {
      toast.success('تمت الإزالة من المفضلة');
    }
    
    return res;
  }, [session?.access_token, removeMutation]);

  // Check if program is in shortlist
  const isInShortlist = useCallback((programId: string): boolean => {
    return items.some(item => item.program_id === programId);
  }, [items]);

  // Refresh shortlist
  const refresh = useCallback(() => {
    if (session?.access_token) {
      refetch();
    }
  }, [session?.access_token, refetch]);

  return {
    // State
    items,
    count,
    limit,
    isLoading,
    isAuthenticated,
    
    // Actions
    add,
    remove,
    refresh,
    isInShortlist,
    
    // Mutation states
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}

/**
 * Hook for fetching comparison data
 */
export function useShortlistCompare() {
  const { isAuthenticated, count } = usePortalShortlist();

  const { 
    data, 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: SHORTLIST_COMPARE_KEY,
    queryFn: shortlistCompare,
    enabled: isAuthenticated && count > 0,
    staleTime: 30_000, // 30 seconds
  });

  const compareItems: ShortlistCompareItem[] = data?.items ?? [];

  return {
    compareItems,
    compareCount: data?.count ?? 0,
    isLoading,
    refetch,
  };
}
