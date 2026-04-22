/**
 * usePortalNotifications — persistent per-user notifications stored in
 * public.portal_notifications. Capped at 50 newest by a DB trigger.
 *
 * Responsibilities:
 *  - Read the user's stored notifications.
 *  - Upsert new notifications coming from live signals (identity, threads).
 *  - Mark single / all as read.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCommThreads, type CommThread } from '@/hooks/useCommApi';
import { useIdentityStatus } from '@/hooks/useIdentityStatus';

export type PortalNotifKind = 'identity' | 'support' | 'message' | 'system';

export interface PortalNotification {
  id: string;
  kind: PortalNotifKind;
  title: string;
  preview: string | null;
  link_path: string | null;
  source_key: string | null;
  read_at: string | null;
  created_at: string;
}

interface UpsertInput {
  kind: PortalNotifKind;
  title: string;
  preview?: string | null;
  link_path?: string | null;
  source_key: string;
  created_at?: string;
}

export function usePortalNotifications() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const { threads, refresh: refreshThreads } = useCommThreads();
  const { status: identity } = useIdentityStatus();

  // Resolve session user
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('portal_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setItems(data as PortalNotification[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription for inserts/updates/deletes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`portal_notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'portal_notifications', filter: `user_id=eq.${userId}` },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  // Upsert helper (idempotent on user_id + source_key)
  const upsert = useCallback(
    async (input: UpsertInput) => {
      if (!userId) return;
      await supabase
        .from('portal_notifications')
        .upsert(
          {
            user_id: userId,
            kind: input.kind,
            title: input.title,
            preview: input.preview ?? null,
            link_path: input.link_path ?? null,
            source_key: input.source_key,
            created_at: input.created_at ?? new Date().toISOString(),
          },
          { onConflict: 'user_id,source_key', ignoreDuplicates: false },
        );
    },
    [userId],
  );

  // Sync live signals into persistent store
  useEffect(() => {
    if (!userId) return;

    // Identity
    if (identity?.identity_status && identity.identity_status !== 'none') {
      const s = identity.identity_status;
      const decidedAt = identity.decided_at || new Date().toISOString();
      let title = 'Identity status update';
      if (s === 'approved') title = 'Your identity has been verified';
      else if (s === 'rejected') title = 'Identity verification needs your attention';
      else if (s === 'pending') title = 'Your identity is under review';

      upsert({
        kind: 'identity',
        title,
        source_key: `identity:${s}:${decidedAt}`,
        link_path: '/portal/identity',
        created_at: decidedAt,
      });
    }

    // Threads with unread messages
    threads.forEach((th: CommThread) => {
      if ((th.unread_count ?? 0) <= 0) return;
      const isSupport =
        th.thread_type === 'support' ||
        th.thread_type === 'system_notice' ||
        th.thread_type === 'security_notice';
      const ts = th.last_message_at || th.updated_at || th.created_at;
      upsert({
        kind: isSupport ? 'support' : 'message',
        title: th.display_name || th.subject || (isSupport ? 'New message from Support' : 'New message'),
        preview: th.last_message_preview || null,
        link_path: '/messages',
        source_key: `thread:${th.id}:${ts}`,
        created_at: ts,
      });
    });
  }, [userId, identity, threads, upsert]);

  const markRead = useCallback(
    async (id: string) => {
      await supabase
        .from('portal_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id);
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from('portal_notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
  }, [userId]);

  const unreadCount = useMemo(() => items.filter((i) => !i.read_at).length, [items]);

  return {
    items,
    loading,
    unreadCount,
    markRead,
    markAllRead,
    refresh: load,
    refreshThreads,
  };
}
