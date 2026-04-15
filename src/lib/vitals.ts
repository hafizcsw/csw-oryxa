import { supabase } from "@/integrations/supabase/client";

// Idempotent guard to prevent duplicate initialization
let vitalsStarted = false;

export function initWebVitals() {
  // Prevent duplicate initialization
  if (vitalsStarted) {
    console.debug("[WebVitals] Already initialized, skipping");
    return;
  }
  vitalsStarted = true;

  // Dynamically import web-vitals only when needed
  import("web-vitals").then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
    const sendMetric = async (name: string, value: number, rating: string) => {
      try {
        const visitor_id = localStorage.getItem("visitor_id") || crypto.randomUUID();
        localStorage.setItem("visitor_id", visitor_id);
        
        // Get or create session_id
        const session_id = sessionStorage.getItem("analytics_session_id") || crypto.randomUUID();
        sessionStorage.setItem("analytics_session_id", session_id);

        // Build webvital payload with proper structure
        const props: { [key: string]: string | number | boolean | null } = {
          route: window.location.pathname,
          value: Math.round(value),
          rating,
          visitor_id, // Store visitor_id in payload, not as column
          is_bot: /bot|crawl|spider/i.test(navigator.userAgent),
        };
        
        // Add specific metric values for SQL queries
        if (name === 'LCP') {
          props.lcp_ms = Math.round(value);
        } else if (name === 'CLS') {
          props.cls = Number(value.toFixed(3));
        } else if (name === 'INP') {
          props.fid_ms = Math.round(value);
        }

        // Fire-and-forget: Use session_id column (exists in schema)
        await supabase.from("analytics_events").insert([{
          event: 'webvital',
          route: window.location.pathname,
          session_id, // Use session_id column (exists in schema)
          tab: 'performance',
          payload: props
        }]);
      } catch (error) {
        // Silent fail - don't block user experience
        console.debug("[WebVitals] Metric failed to send:", error);
      }
    };

    // Core Web Vitals
    onLCP((metric) => sendMetric("LCP", metric.value, metric.rating));
    onINP((metric) => sendMetric("INP", metric.value, metric.rating));
    onCLS((metric) => sendMetric("CLS", metric.value, metric.rating));

    // Additional metrics
    onFCP((metric) => sendMetric("FCP", metric.value, metric.rating));
    onTTFB((metric) => sendMetric("TTFB", metric.value, metric.rating));
  }).catch((error) => {
    console.debug("[WebVitals] Not loaded:", error);
  });
}
