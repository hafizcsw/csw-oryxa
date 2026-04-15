import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export interface TimelineEvent {
  id: string;
  event_type: string;
  event_title: string;
  event_description: string | null;
  event_data: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
  is_read?: boolean;
}

export function useStudentTimeline(userId: string | undefined) {
  const { t } = useLanguage();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureAvailable, setFeatureAvailable] = useState(true);

  const loadTimeline = useCallback(async () => {
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

      if (res.error) {
        throw res.error;
      }

      if (!res.data?.ok) {
        if (res.data?.error === 'FEATURE_NOT_AVAILABLE') {
          setFeatureAvailable(false);
          setEvents([]);
        } else {
          throw new Error(res.data?.error || t('hooks.timeline.loadFailed'));
        }
        return;
      }

      // Map CRM response to TimelineEvent format
      const crmEvents = res.data.data || [];
      const mappedEvents: TimelineEvent[] = crmEvents.map((e: Record<string, unknown>) => ({
        id: e.id as string,
        event_type: e.event_type as string || 'general',
        event_title: e.title as string || e.event_title as string || '',
        event_description: e.message as string || e.event_description as string || null,
        event_data: e.event_data as Record<string, unknown> || null,
        created_at: e.created_at as string,
        created_by: e.created_by as string || null,
        is_read: e.is_read as boolean ?? true,
      }));

      setEvents(mappedEvents);
      setFeatureAvailable(true);
    } catch (err) {
      console.error('Error loading timeline:', err);
      setError(err instanceof Error ? err.message : t('hooks.timeline.errorOccurred'));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  return { 
    events, 
    loading, 
    error, 
    featureAvailable,
    refetch: loadTimeline 
  };
}
