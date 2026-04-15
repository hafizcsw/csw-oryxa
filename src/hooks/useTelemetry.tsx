import { supabase } from "@/integrations/supabase/client";

export function useTelemetry() {
  const logEvent = async (eventName: string, properties?: Record<string, any>) => {
    try {
      const visitorId = localStorage.getItem('visitor_id') || crypto.randomUUID();
      localStorage.setItem('visitor_id', visitorId);

      await supabase.functions.invoke('telemetry-capture', {
        body: {
          event_name: eventName,
          visitor_id: visitorId,
          meta: properties || {}
        }
      });
    } catch (error) {
      console.error('Telemetry error:', error);
    }
  };

  return {
    logEvent,
    logFilterChanged: (filters: any) => logEvent('filter_changed', filters),
    logResultsLoaded: (count: number, latency: number) => 
      logEvent('results_loaded', { count, latency_ms: latency }),
    logShortlistAdd: (universityId: string) => 
      logEvent('shortlist_add', { university_id: universityId }),
    logShortlistRemove: (universityId: string) => 
      logEvent('shortlist_remove', { university_id: universityId }),
    logShortlistLimitHit: () => logEvent('shortlist_limit_hit'),
    logApplyClicked: (universityIds: string[]) => 
      logEvent('apply_clicked', { selected_universities: universityIds }),
    logCardImpression: (universityId: string) => 
      logEvent('card_impression', { university_id: universityId })
  };
}
