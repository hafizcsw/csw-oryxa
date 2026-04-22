import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crm, type SupportMessage, type CrmEnvelope } from '@/lib/crmBridge';

export function useSupportMessages(caseId: string | undefined) {
  const qc = useQueryClient();

  const messagesQuery = useQuery<CrmEnvelope<SupportMessage[]>>({
    queryKey: ['support', 'messages', caseId],
    queryFn: () => crm.listSupportMessages(caseId as string),
    enabled: !!caseId,
    refetchInterval: 15_000,
  });

  // Mark as read on mount and whenever message list changes (and we have a case id)
  useEffect(() => {
    if (!caseId) return;
    crm.markSupportRead(caseId).then(() => {
      qc.invalidateQueries({ queryKey: ['support', 'cases'] });
    });
  }, [caseId, messagesQuery.data?.data?.length, qc]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => crm.sendSupportMessage(caseId as string, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'messages', caseId] });
      qc.invalidateQueries({ queryKey: ['support', 'cases'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => crm.closeSupportCase(caseId as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support', 'case', caseId] });
      qc.invalidateQueries({ queryKey: ['support', 'cases'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: () => crm.markSupportRead(caseId as string),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support', 'cases'] }),
  });

  return {
    messagesQuery,
    sendMessage: sendMutation.mutateAsync,
    sending: sendMutation.isPending,
    sendError: sendMutation.data?.ok === false ? sendMutation.data.error : undefined,
    closeCase: closeMutation.mutateAsync,
    closing: closeMutation.isPending,
    markRead: markReadMutation.mutateAsync,
  };
}
