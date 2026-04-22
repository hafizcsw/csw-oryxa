import { useQuery } from '@tanstack/react-query';
import { crm, type SupportCase, type CrmEnvelope } from '@/lib/crmBridge';

export function useSupportCases() {
  return useQuery<CrmEnvelope<SupportCase[]>>({
    queryKey: ['support', 'cases'],
    queryFn: () => crm.listSupportCases(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
