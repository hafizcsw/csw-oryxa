import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Friendship {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  course_key: string | null;
  created_at: string;
  requester_name?: string;
  requester_avatar?: string;
  recipient_name?: string;
  recipient_avatar?: string;
}

export interface FriendSuggestion {
  user_id: string;
  full_name: string;
  avatar_storage_path: string | null;
  course_key?: string;
}

export function useStudentFriendships(userId: string | null | undefined, courseKey = 'russian') {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriendships = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('student_friendships')
      .select('*')
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (data) {
      // Enrich with profile names
      const userIds = new Set<string>();
      data.forEach(f => { userIds.add(f.requester_id); userIds.add(f.recipient_id); });
      userIds.delete(userId);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_storage_path')
        .in('user_id', Array.from(userIds));

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const enriched: Friendship[] = data.map(f => ({
        ...f,
        status: f.status as Friendship['status'],
        requester_name: profileMap.get(f.requester_id)?.full_name || undefined,
        requester_avatar: profileMap.get(f.requester_id)?.avatar_storage_path || undefined,
        recipient_name: profileMap.get(f.recipient_id)?.full_name || undefined,
        recipient_avatar: profileMap.get(f.recipient_id)?.avatar_storage_path || undefined,
      }));

      setFriendships(enriched);
    }
  }, [userId]);

  const fetchSuggestions = useCallback(async () => {
    if (!userId) return;

    // Get existing friendship user IDs to exclude
    const existingIds = new Set<string>();
    friendships.forEach(f => {
      existingIds.add(f.requester_id);
      existingIds.add(f.recipient_id);
    });
    existingIds.add(userId);

    const excludeArray = Array.from(existingIds);

    // Get other students from profiles (random suggestions)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_storage_path')
      .not('user_id', 'in', `(${excludeArray.join(',')})`)
      .not('full_name', 'is', null)
      .limit(10);

    setSuggestions(
      (profiles || [])
        .filter(p => p.full_name)
        .map(p => ({
          user_id: p.user_id,
          full_name: p.full_name!,
          avatar_storage_path: p.avatar_storage_path,
        }))
    );
  }, [userId, courseKey, friendships]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetchFriendships().finally(() => setLoading(false));
  }, [userId, fetchFriendships]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('friendships-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_friendships' }, () => {
        fetchFriendships();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchFriendships]);

  const sendRequest = useCallback(async (recipientId: string) => {
    if (!userId) return;
    await supabase.from('student_friendships').insert({
      requester_id: userId,
      recipient_id: recipientId,
      course_key: courseKey,
    });
    fetchFriendships();
    fetchSuggestions();
  }, [userId, courseKey, fetchFriendships, fetchSuggestions]);

  const acceptRequest = useCallback(async (friendshipId: string) => {
    await supabase.from('student_friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    fetchFriendships();
  }, [fetchFriendships]);

  const rejectRequest = useCallback(async (friendshipId: string) => {
    await supabase.from('student_friendships').update({ status: 'rejected' }).eq('id', friendshipId);
    fetchFriendships();
    fetchSuggestions();
  }, [fetchFriendships, fetchSuggestions]);

  const removeFriend = useCallback(async (friendshipId: string) => {
    await supabase.from('student_friendships').delete().eq('id', friendshipId);
    fetchFriendships();
    fetchSuggestions();
  }, [fetchFriendships, fetchSuggestions]);

  const pendingReceived = friendships.filter(f => f.status === 'pending' && f.recipient_id === userId);
  const pendingSent = friendships.filter(f => f.status === 'pending' && f.requester_id === userId);
  const friends = friendships.filter(f => f.status === 'accepted');

  return {
    friendships, friends, pendingReceived, pendingSent, suggestions,
    loading, sendRequest, acceptRequest, rejectRequest, removeFriend,
    refetch: fetchFriendships,
  };
}
