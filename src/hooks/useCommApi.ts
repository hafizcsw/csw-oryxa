/**
 * useCommApi — Hook for the canonical communication backbone.
 * All messaging goes through the comm-api edge function.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CommThread {
  id: string;
  thread_type: string;
  status: string;
  priority: string;
  subject: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  university_id: string | null;
  assigned_to: string | null;
  created_by: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
  // enriched
  unread_count: number;
  display_name: string;
  display_avatar: string | null;
  participant_count: number;
}

export interface CommMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
  // enriched
  sender_name: string | null;
  sender_avatar: string | null;
}

async function invokeComm(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('comm-api', {
    body: { action, ...body },
  });
  if (error) throw error;
  if (data && !data.ok) throw new Error(data.error || 'Unknown error');
  return data;
}

export function useCommThreads(options?: {
  filterType?: string | string[];
  filterStatus?: string;
  universityId?: string;
}) {
  const [threads, setThreads] = useState<CommThread[]>([]);
  const [loading, setLoading] = useState(true);
  const optRef = useRef(options);
  optRef.current = options;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invokeComm('thread.list', {
        filter_type: optRef.current?.filterType,
        filter_status: optRef.current?.filterStatus,
        university_id: optRef.current?.universityId,
      });
      setThreads(data.threads || []);
    } catch (e) {
      console.error('[useCommThreads]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { threads, loading, refresh: fetch };
}

export function useCommMessages(threadId: string | null) {
  const [messages, setMessages] = useState<CommMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!threadId) return;
    setLoading(true);
    try {
      const data = await invokeComm('thread.messages', { thread_id: threadId });
      setMessages(data.messages || []);
    } catch (e) {
      console.error('[useCommMessages]', e);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime for new messages
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`comm-msgs-${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comm_messages',
        filter: `thread_id=eq.${threadId}`,
      }, (payload) => {
        const newMsg = payload.new as CommMessage;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId]);

  return { messages, loading, refresh: fetch };
}

export function useCommUnreadCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await invokeComm('thread.unread_counts');
      setCount(data.total_unread || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { count, loading, refresh };
}

export async function commCreateThread(params: {
  thread_type: string;
  subject?: string;
  first_message: string;
  university_id?: string;
  participants?: Array<{ user_id: string; role?: string }>;
  linked_entity_type?: string;
  linked_entity_id?: string;
}) {
  return invokeComm('thread.create', params);
}

export async function commSendMessage(params: {
  thread_id: string;
  body: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
}) {
  return invokeComm('message.send', params);
}

export async function commMarkRead(threadId: string) {
  return invokeComm('message.read', { thread_id: threadId });
}

export async function commAssignThread(threadId: string, assignTo: string | null) {
  return invokeComm('thread.assign', { thread_id: threadId, assign_to: assignTo });
}

export async function commChangeStatus(threadId: string, status: string) {
  return invokeComm('thread.status', { thread_id: threadId, status });
}
