import { supabase } from "@/integrations/supabase/client";

// ✅ Fix #4: Rate limiting (Opt-in فقط للأحداث الثقيلة)
const RATE_LIMITED_EVENTS = new Set([
  "page_view",
  "auth_signed_in",
  "filter_changed",
  "card_impression"
]);

const recentEvents = new Map<string, number>();
const COOLDOWN_MS = 5000; // 5 ثواني

export function track(event: string, props: Record<string, any> = {}) {
  try {
    // ✅ Rate limit فقط للأحداث الثقيلة
    if (RATE_LIMITED_EVENTS.has(event)) {
      const eventKey = `${event}:${props.user_id || props.university_id || 'global'}`;
      const now = Date.now();
      const lastTime = recentEvents.get(eventKey);
      
      if (lastTime && now - lastTime < COOLDOWN_MS) {
        console.log("[Analytics] ⏭️ Rate limited:", event);
        return;
      }
      recentEvents.set(eventKey, now);
    }
    
    console.log("[Analytics]", event, props);
    const visitor_id = localStorage.getItem("visitor_id") || "";
    supabase.functions.invoke('log-event', {
      body: { name: event, visitor_id, properties: props }
    }).catch(e => console.warn("[Analytics] log-event failed:", e));
  } catch (e) {
    console.warn("[Analytics] Failed:", e);
  }
}

// New analytics helpers for detailed tracking
function getSessionId() {
  const key = "analytics_session_id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}

export async function trackDetailed(
  tab: string,
  event: string,
  payload: any = {},
  latency_ms?: number
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        user_id: user?.id || null,
        session_id: getSessionId(),
        tab,
        event,
        payload,
        latency_ms,
        route: window.location.pathname,
      }),
    });
  } catch (error) {
    console.error("[analytics] Track error:", error);
  }
}

export async function callEdgeWithMetrics(
  endpoint: string,
  body: any,
  tab: string
) {
  const t0 = performance.now();
  
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1${endpoint}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }
  );
  
  const json = await res.json();
  const t1 = performance.now();
  const latency = Math.round(t1 - t0);
  
  // Track the API call with metrics
  await trackDetailed(tab, "results_loaded", {
    endpoint,
    ok: res.ok,
    count: json?.count ?? json?.items?.length ?? 0,
  }, latency);
  
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Edge function error: ${res.status}`);
  }
  
  return json;
}
