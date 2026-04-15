import { supabase } from "@/integrations/supabase/client";

export function useBotTelemetry() {
  const send = async (name: string, meta: Record<string, any> = {}) => {
    try {
      await supabase.functions.invoke('telemetry-capture', {
        body: {
          event_name: name,
          meta: {
            ...meta,
            timestamp: new Date().toISOString(),
            route: window.location.pathname
          }
        }
      });
    } catch (e) {
      console.warn('[BotTelemetry] Failed:', e);
    }
  };

  return {
    send,
    botStarted: (placement: string = 'hero') => 
      send('bot_started', { placement }),
    botResultsShown: (count: number, latencyMs: number, mode: string) =>
      send('bot_results_shown', { count, latency_ms: latencyMs, mode }),
    selectionSubmitted: (count: number, mode: string) =>
      send('selection_submitted', { count, mode }),
    botError: (step: string, message: string) =>
      send('bot_error', { step, error_len: message?.length || 0 })
  };
}
