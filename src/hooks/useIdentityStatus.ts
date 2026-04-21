import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getIdentityStatus, type IdentityStatusReadback } from "@/api/identitySupportInvoke";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT: IdentityStatusReadback = {
  identity_status: "none",
  blocks_academic_file: true,
  last_activation_id: null,
  decision_reason_code: null,
  reupload_required_fields: null,
  decided_at: null,
};

const CACHE_KEY = "identity_status_cache_v1";

// Only "terminal" CRM decisions are safe to cache aggressively.
// pending/none must always re-check CRM, because the Supabase mirror
// table is not always updated by CRM and realtime won't fire.
const TERMINAL_STATUSES = new Set(["approved", "rejected", "reupload_required"]);

interface CacheEntry {
  user_id: string;
  status: IdentityStatusReadback;
  cached_at: string;
}

function readCache(userId: string | null): IdentityStatusReadback | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || parsed.user_id !== userId || !parsed.status) return null;
    return parsed.status;
  } catch {
    return null;
  }
}

function writeCache(userId: string | null, status: IdentityStatusReadback) {
  if (!userId || typeof window === "undefined") return;
  try {
    const entry: CacheEntry = {
      user_id: userId,
      status,
      cached_at: new Date().toISOString(),
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore quota / serialization errors */
  }
}

function clearCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// Module-level signed-out listener — clears cache once per session.
let authListenerInstalled = false;
function ensureAuthListener(qc: ReturnType<typeof useQueryClient>) {
  if (authListenerInstalled || typeof window === "undefined") return;
  authListenerInstalled = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      clearCache();
      qc.removeQueries({ queryKey: ["identity-status"] });
    }
  });
}

export function useIdentityStatus() {
  const qc = useQueryClient();
  const userIdRef = useRef<string | null>(null);

  // Resolve current user id + subscribe to CRM-driven mirror changes.
  // The mirror table `identity_status_mirror` is the only source of truth
  // for invalidation: when CRM pushes a new status (approve/reject/etc.),
  // a row UPDATE/INSERT lands here and we refetch + rewrite the cache.
  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const uid = data.user?.id ?? null;
      userIdRef.current = uid;
      if (!uid) return;

      channel = supabase
        .channel(`identity-mirror-${uid}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'identity_status_mirror',
            filter: `user_id=eq.${uid}`,
          },
          () => {
            // CRM-driven change → bypass cache and refetch from CRM.
            void refetch();
          }
        )
        .subscribe();
    });

    ensureAuthListener(qc);
    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  const q = useQuery({
    queryKey: ["identity-status"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      userIdRef.current = userId;

      // Cache-first: if we already have a cached status for this user,
      // return it without hitting CRM. CRM-driven invalidation is the
      // only path that should refresh this cache.
      const cached = readCache(userId);
      if (cached) return cached;

      const res = await getIdentityStatus();
      const status = res.ok && res.data ? res.data : DEFAULT;
      if (res.ok && res.data) writeCache(userId, status);
      return status;
    },
    // Cache-first behavior: never auto-revalidate. Only explicit refetch()
    // (e.g. after a CRM-driven mirror update) should refresh.
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Wrap refetch so any CRM-driven refresh also updates the local cache.
  const refetch = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    const res = await getIdentityStatus();
    const status = res.ok && res.data ? res.data : DEFAULT;
    if (res.ok && res.data) writeCache(userId, status);
    qc.setQueryData(["identity-status"], status);
    return status;
  };

  return {
    status: q.data ?? DEFAULT,
    loading: q.isLoading,
    refetch,
  };
}
