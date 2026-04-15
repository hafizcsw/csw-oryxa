import { supabase } from "@/integrations/supabase/client";
import { classifyTraffic } from "./trafficClassifier";

export function track(event: string, props: Record<string, any> = {}) {
  try {
    const visitor_id = localStorage.getItem("visitor_id") || "";
    const traffic = classifyTraffic(visitor_id);
    
    supabase.functions.invoke('log-event', {
      body: { 
        name: event, 
        visitor_id, 
        properties: { ...props },
        hostname: traffic.hostname,
        environment: traffic.environment,
        traffic_class: traffic.traffic_class,
        is_admin: traffic.is_admin,
        is_test: traffic.is_test,
      }
    }).catch(e => console.warn("[Analytics] log-event failed:", e));
  } catch (e) {
    console.warn("[Analytics] Failed:", e);
  }
}

/**
 * Unified telemetry capture for button actions
 * Sends to log-event edge function with traffic classification
 */
export async function captureTelemetry(
  event: string,
  payload: Record<string, any> = {}
): Promise<void> {
  try {
    const visitor_id = localStorage.getItem("visitor_id") || crypto.randomUUID();
    localStorage.setItem("visitor_id", visitor_id);
    const traffic = classifyTraffic(visitor_id);

    await supabase.functions.invoke('log-event', {
      body: {
        name: event,
        visitor_id,
        properties: {
          ...payload,
          timestamp: new Date().toISOString(),
          route: window.location.pathname
        },
        hostname: traffic.hostname,
        environment: traffic.environment,
        traffic_class: traffic.traffic_class,
        is_admin: traffic.is_admin,
        is_test: traffic.is_test,
      }
    });

    console.log(`[Telemetry] ${event}`, payload);
  } catch (error) {
    console.warn("[Telemetry] Capture failed:", error);
  }
}
