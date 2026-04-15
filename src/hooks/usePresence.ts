/**
 * usePresence — Tracks and broadcasts user online status.
 * Updates last_seen_at every 30s. Considers users online if seen within 2 minutes.
 */
import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL = 30_000; // 30s
const ONLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

export interface PresenceInfo {
  is_online: boolean;
  last_seen_at: string;
}

/**
 * Sends heartbeats for the current user.
 * Call once at app-level or in ChatPanel.
 */
export function usePresenceHeartbeat() {
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let mounted = true;

    const beat = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !mounted) return;

      await supabase.from('user_presence').upsert(
        {
          user_id: session.user.id,
          last_seen_at: new Date().toISOString(),
          is_online: true,
        },
        { onConflict: 'user_id' }
      );
    };

    beat();
    interval = setInterval(beat, HEARTBEAT_INTERVAL);

    // Mark offline on unmount / tab close
    const markOffline = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      await supabase.from('user_presence').upsert(
        {
          user_id: session.user.id,
          last_seen_at: new Date().toISOString(),
          is_online: false,
        },
        { onConflict: 'user_id' }
      );
    };

    window.addEventListener('beforeunload', markOffline);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('beforeunload', markOffline);
      markOffline();
    };
  }, []);
}

/**
 * Fetches presence for a list of user IDs with realtime updates.
 */
export function useUserPresence(userIds: string[]) {
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceInfo>>({});
  const idsKey = userIds.sort().join(',');

  const fetchPresence = useCallback(async () => {
    if (userIds.length === 0) return;
    const { data } = await supabase
      .from('user_presence')
      .select('user_id, last_seen_at, is_online')
      .in('user_id', userIds);

    if (data) {
      const map: Record<string, PresenceInfo> = {};
      data.forEach(row => {
        map[row.user_id] = {
          is_online: row.is_online && (Date.now() - new Date(row.last_seen_at).getTime() < ONLINE_THRESHOLD),
          last_seen_at: row.last_seen_at,
        };
      });
      setPresenceMap(map);
    }
  }, [idsKey]);

  useEffect(() => {
    fetchPresence();
  }, [fetchPresence]);

  // Realtime subscription
  useEffect(() => {
    if (userIds.length === 0) return;

    const channel = supabase
      .channel('user-presence-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence',
      }, (payload) => {
        const row = payload.new as any;
        if (row && userIds.includes(row.user_id)) {
          setPresenceMap(prev => ({
            ...prev,
            [row.user_id]: {
              is_online: row.is_online && (Date.now() - new Date(row.last_seen_at).getTime() < ONLINE_THRESHOLD),
              last_seen_at: row.last_seen_at,
            },
          }));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [idsKey]);

  return presenceMap;
}

/**
 * Returns a human-readable "last seen" string.
 */
export function getLastSeenText(
  lastSeenAt: string | undefined,
  t: (key: string, options?: any) => string
): string {
  if (!lastSeenAt) return t('chat.offline', { defaultValue: 'Offline' });

  const diff = Date.now() - new Date(lastSeenAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 2) return t('chat.online', { defaultValue: 'Online' });
  if (minutes < 60) return t('chat.lastSeenMinutes', { defaultValue: '{{count}} min ago', count: minutes });
  if (hours < 24) return t('chat.lastSeenHours', { defaultValue: '{{count}}h ago', count: hours });
  return t('chat.lastSeenDays', { defaultValue: '{{count}}d ago', count: days });
}
