import { useQuery } from '@tanstack/react-query';
import { crm, type IdentityCase, type CrmEnvelope } from '@/lib/crmBridge';

export function useIdentityCase() {
  return useQuery<CrmEnvelope<IdentityCase>>({
    queryKey: ['identity', 'case'],
    queryFn: () => crm.getIdentityCase(),
    staleTime: 30_000,
  });
}
