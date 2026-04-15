import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getShortlist, syncShortlist } from "@/lib/portalApi";

/**
 * @deprecated Use useUnifiedShortlist instead - this hook sends IDs only (causes "Unknown" in CRM).
 * For V3 snapshot sync, use syncShortlistWithSnapshots from portalApi.
 */
export function useShortlist() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["shortlist"],
    queryFn: async () => {
      const res = await getShortlist();
      // Keep error shape for error_code handling
      if (res?.ok === false) return res;
      return res;
    },
    // ✅ P0 PATCH 3: Reduced staleTime + better refetch settings
    staleTime: 5_000, // 5 seconds instead of 60
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev, // Prevents flicker by keeping old data while refetching
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
