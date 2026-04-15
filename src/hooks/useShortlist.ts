import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getShortlist, syncShortlist } from "@/lib/portalApi";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * @deprecated Use useUnifiedShortlist instead - this hook sends IDs only (causes "Unknown" in CRM).
 * For V3 snapshot sync, use syncShortlistWithSnapshots from portalApi.
 */
export function useShortlist() {
  const qc = useQueryClient();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session?.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const query = useQuery({
    queryKey: ["shortlist"],
    queryFn: async () => {
      const res = await getShortlist();
      if (res?.ok === false) return res;
      return res;
    },
    enabled: hasSession,
    staleTime: 5_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: async (programIds: string[]) => {
      const res = await syncShortlist(programIds);
      if (res?.ok === false) throw res;
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shortlist"] }),
  });

  // Extract shortlisted programs from the response
  const shortlistedPrograms = query.data?.ok !== false 
    ? ((query.data as any)?.data?.shortlisted_programs || [])
    : [];

  return {
    data: query.data,
    shortlist: shortlistedPrograms,
    loading: query.isLoading,
    error: query.error,
    error_code: query.data?.ok === false ? (query.data as any)?.error_code : null,
    refetch: query.refetch,
    sync: mutation.mutateAsync,
    syncing: mutation.isPending,
  };
}
