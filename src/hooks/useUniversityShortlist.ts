/**
 * University Shortlist Hook
 * Manages university favorites via portal edge function RPCs
 */
import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Session } from '@supabase/supabase-js';

// ============= API Functions =============
// In-flight dedupe: collapses concurrent identical calls (e.g. uni shortlist
// fetched simultaneously by Layout, ShortlistDrawer, ServicesTab) into one
// network request to avoid stampedes on the edge function.
const inflightUniCalls = new Map<string, Promise<any>>();

async function callPortalApi<T = unknown>(action: string, params?: Record<string, unknown>): Promise<T> {
  const key = `${action}::${params ? JSON.stringify(params) : ''}`;
  const existing = inflightUniCalls.get(key);
  if (existing) return existing as Promise<T>;

  const exec = (async () => {
    const res = await supabase.functions.invoke('student-portal-api', {
      body: { action, ...params }
    });
    if (res.error) {
      const errorCode = (res.error as any).status === 401 ? 'auth_required' : 'network_error';
      return { ok: false, error: res.error.message, error_code: errorCode } as T;
    }
    return res.data as T;
  })();

  inflightUniCalls.set(key, exec);
  exec.finally(() => inflightUniCalls.delete(key));
  return exec;
}

export interface UniShortlistItem {
  university_id: string;
  created_at: string;
}

interface UniShortlistListResponse {
  ok: boolean;
  count: number;
  limit: number;
  items: UniShortlistItem[];
  error_code?: string;
}

interface UniShortlistAddResponse {
  ok: boolean;
  added?: boolean;
  already_exists?: boolean;
  count: number;
  limit: number;
  limit_reached: boolean;
  error_code?: string;
}

interface UniShortlistRemoveResponse {
  ok: boolean;
  removed?: boolean;
  count: number;
  limit: number;
  error_code?: string;
}

const UNI_SHORTLIST_KEY = ['uni-shortlist'];

export function useUniversityShortlistHook() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isAuthenticated = !!session?.access_token;

  const { data: listData, isLoading, refetch } = useQuery({
    queryKey: UNI_SHORTLIST_KEY,
    queryFn: () => callPortalApi<UniShortlistListResponse>('uni_shortlist_list'),
    enabled: authReady && isAuthenticated,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const items: UniShortlistItem[] = listData?.items ?? [];
  const count = listData?.count ?? 0;

  const addMutation = useMutation({
    mutationFn: (universityId: string) => callPortalApi<UniShortlistAddResponse>('uni_shortlist_add', { university_id: universityId }),
    onSuccess: (res) => { if (res.ok) queryClient.invalidateQueries({ queryKey: UNI_SHORTLIST_KEY }); },
  });

  const removeMutation = useMutation({
    mutationFn: (universityId: string) => callPortalApi<UniShortlistRemoveResponse>('uni_shortlist_remove', { university_id: universityId }),
    onSuccess: (res) => { if (res.ok) queryClient.invalidateQueries({ queryKey: UNI_SHORTLIST_KEY }); },
  });

  const add = useCallback(async (universityId: string) => {
    if (!session?.access_token) return { ok: false, error_code: 'not_authenticated' } as UniShortlistAddResponse;
    const res = await addMutation.mutateAsync(universityId);
    if (res.ok && res.added) toast.success('تمت إضافة الجامعة للمفضلة ❤️');
    return res;
  }, [session?.access_token, addMutation]);

  const remove = useCallback(async (universityId: string) => {
    if (!session?.access_token) return { ok: false, error_code: 'not_authenticated' } as UniShortlistRemoveResponse;
    const res = await removeMutation.mutateAsync(universityId);
    if (res.ok && res.removed) toast.success('تمت إزالة الجامعة من المفضلة');
    return res;
  }, [session?.access_token, removeMutation]);

  const isInShortlist = useCallback((universityId: string): boolean => {
    return items.some(item => item.university_id === universityId);
  }, [items]);

  return {
    items, count, isLoading, isAuthenticated,
    add, remove, isInShortlist, refresh: refetch,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
