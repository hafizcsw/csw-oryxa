import { useQuery } from "@tanstack/react-query";
import { getIdentityStatus, type IdentityStatusReadback } from "@/api/identitySupportInvoke";

const DEFAULT: IdentityStatusReadback = {
  identity_status: "none",
  blocks_academic_file: true,
  last_activation_id: null,
  decision_reason_code: null,
  reupload_required_fields: null,
  decided_at: null,
};

export function useIdentityStatus() {
  const q = useQuery({
    queryKey: ["identity-status"],
    queryFn: async () => {
      const res = await getIdentityStatus();
      if (!res.ok || !res.data) return DEFAULT;
      return res.data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  return {
    status: q.data ?? DEFAULT,
    loading: q.isLoading,
    refetch: q.refetch,
  };
}
