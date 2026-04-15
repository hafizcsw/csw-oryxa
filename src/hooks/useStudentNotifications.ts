import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

const LAST_SEEN_KEY = "student_portal_last_seen_notifications";

export interface StudentNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
}

export function useStudentNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureAvailable, setFeatureAvailable] = useState(true);
  const [lastSeenAt, setLastSeenAt] = useState<Date | null>(null);

  // Load lastSeenAt from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    if (stored) {
      const d = new Date(stored);
      if (!Number.isNaN(d.getTime())) {
        setLastSeenAt(d);
      }
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const res = await supabase.functions.invoke('student-portal-api', {
        body: { action: 'get_events' },
      });

      // Handle both error in response and FEATURE_NOT_AVAILABLE
      if (res.error || !res.data?.ok) {
        const errorCode = res.data?.error || res.error?.message;
        if (errorCode === 'FEATURE_NOT_AVAILABLE' || res.data?.error === 'FEATURE_NOT_AVAILABLE') {
          setFeatureAvailable(false);
          setNotifications([]);
          setLoading(false);
          return;
        }
        throw new Error(res.data?.message || res.error?.message || 'فشل في تحميل الإشعارات');
      }

      // Map CRM events to notifications format
      const crmEvents = res.data.data || [];
      const mappedNotifications: StudentNotification[] = crmEvents.map((e: Record<string, unknown>) => ({
        id: e.id as string,
        title: e.title as string || e.event_title as string || '',
        message: e.message as string || e.event_description as string || '',
        type: e.event_type as string || 'general',
        created_at: e.created_at as string,
      }));

      // Sort from newest to oldest
      mappedNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(mappedNotifications);
      setFeatureAvailable(true);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();

    // Polling every 60 seconds for near real-time updates
    const interval = setInterval(() => {
      loadNotifications();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Calculate unread count based on localStorage lastSeenAt
  const unreadCount = useMemo(() => {
    if (!lastSeenAt) {
      // First time user - all notifications are "unread"
      return notifications.length;
    }
    return notifications.filter(
      (n) => new Date(n.created_at).getTime() > lastSeenAt.getTime()
    ).length;
  }, [notifications, lastSeenAt]);

  // Mark all as seen - saves current time to localStorage
  const markAllSeen = useCallback(() => {
    const now = new Date();
    setLastSeenAt(now);
    localStorage.setItem(LAST_SEEN_KEY, now.toISOString());
  }, []);

  return { 
    notifications, 
    loading, 
    unreadCount,
    error,
    featureAvailable,
    markAllSeen,
    refetch: loadNotifications 
  };
}
