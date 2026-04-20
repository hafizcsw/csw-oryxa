import { useQuery } from "@tanstack/react-query";
import { listSupportTickets, type SupportTicketRow } from "@/api/identitySupportInvoke";

export function useSupportTickets() {
  const q = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const res = await listSupportTickets();
      if (!res.ok || !res.data) return [] as SupportTicketRow[];
      return res.data.tickets;
    },
    staleTime: 30_000,
  });
  return {
    tickets: q.data ?? [],
    loading: q.isLoading,
    refetch: q.refetch,
  };
}
