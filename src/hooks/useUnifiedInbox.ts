/**
 * useUnifiedInbox — Aggregates real messaging sources into a single tagged inbox
 * for the floating Messages tab. NO data unification: each item keeps its native
 * id and type, and points back to its real backend.
 *
 *   Source A: CRM support_cases  (via useSupportCases → student-portal-api)
 *   Source B: comm_threads       (via useCommThreads  → comm-api)
 *
 * Each item carries a `source` tag so the UI can route opens/replies to the
 * correct lane (SupportThread vs CommThreadView). No fake counters, no merging
 * of unrelated entities.
 */
import { useMemo } from 'react';
import { useSupportCases } from './useSupportCases';
import { useCommThreads, type CommThread } from './useCommApi';
import type { SupportCase } from '@/lib/crmBridge';

export type InboxSource =
  | 'support'      // CRM support case
  | 'university'   // comm_thread thread_type=university (or csw_university)
  | 'teacher'      // comm_thread thread_type=teacher (languages)
  | 'peer'         // comm_thread thread_type=peer / student
  | 'application'  // comm_thread thread_type=application
  | 'csw'          // comm_thread thread_type=csw / csw_support / notice / system
  | 'other';

export interface UnifiedInboxItem {
  /** Stable unique id within the inbox (prefixed by source). */
  key: string;
  /** Canonical id in its native lane (case_id for support, thread.id for comm). */
  nativeId: string;
  source: InboxSource;
  title: string;
  preview: string;
  timestamp: string | null;
  unread: boolean;
  isClosed: boolean;
  /** Original payload, kept so routing components can render the real thread. */
  raw:
    | { kind: 'support'; case: SupportCase }
    | { kind: 'comm'; thread: CommThread };
}

function classifyCommThread(t: CommThread): InboxSource {
  const type = (t.thread_type || '').toLowerCase();
  if (type.includes('teacher') || type.includes('language')) return 'teacher';
  if (type.includes('university')) return 'university';
  if (type.includes('peer') || type.includes('student')) return 'peer';
  if (type.includes('application')) return 'application';
  if (type.includes('csw') || type.includes('notice') || type.includes('system') || type.includes('support')) {
    return 'csw';
  }
  return 'other';
}

function mapSupportCase(c: SupportCase): UnifiedInboxItem {
  const ts = c.last_message_at || c.updated_at || c.created_at || null;
  return {
    key: `support:${c.case_id}`,
    nativeId: c.case_id,
    source: 'support',
    title: c.subject || 'Support',
    preview: c.last_message_preview || '',
    timestamp: ts,
    unread: !!c.unread_for_customer,
    isClosed: (c.status || '').toLowerCase() === 'closed',
    raw: { kind: 'support', case: c },
  };
}

function mapCommThread(t: CommThread): UnifiedInboxItem {
  return {
    key: `comm:${t.id}`,
    nativeId: t.id,
    source: classifyCommThread(t),
    title: t.display_name || t.subject || '',
    preview: t.last_message_preview || t.subject || '',
    timestamp: t.last_message_at || t.created_at,
    unread: t.unread_count > 0,
    isClosed: (t.status || '').toLowerCase() === 'closed',
    raw: { kind: 'comm', thread: t },
  };
}

export function useUnifiedInbox() {
  const supportQuery = useSupportCases();
  const { threads, loading: commLoading, refresh: refreshComm } = useCommThreads();

  const items = useMemo<UnifiedInboxItem[]>(() => {
    const supportCases = supportQuery.data?.ok ? supportQuery.data.data?.cases ?? [] : [];
    const merged: UnifiedInboxItem[] = [
      ...supportCases.map(mapSupportCase),
      ...threads.map(mapCommThread),
    ];
    merged.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
    return merged;
  }, [supportQuery.data, threads]);

  const refresh = () => {
    supportQuery.refetch();
    refreshComm();
  };

  return {
    items,
    loading: supportQuery.isLoading || commLoading,
    refresh,
    /** First open support case, or null. Used by the create flow to avoid duplicating cases. */
    openSupportCase: items.find((i) => i.source === 'support' && !i.isClosed) ?? null,
  };
}
