import { useQuery } from '@tanstack/react-query';
import { crm, type SupportCase, type CrmEnvelope } from '@/lib/crmBridge';

export function useSupportCase(caseId: string | undefined) {
  return useQuery<CrmEnvelope<SupportCase>>({
    queryKey: ['support', 'case', caseId],
    queryFn: () => crm.getSupportCase(caseId as string),
    enabled: !!caseId,
    staleTime: 10_000,
  });
}
