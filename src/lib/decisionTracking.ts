/**
 * Decision Tracking Module
 * Tracks engaged time, scroll depth, funnel steps, entity views, and search events
 * All events go to the `events` table via direct insert (lightweight)
 * Now includes traffic classification for real vs dev separation.
 */
import { supabase } from "@/integrations/supabase/client";
import { classifyTraffic } from "./trafficClassifier";

function getVisitorId(): string {
  const key = "csw_visitor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function getSessionId(): string {
  const key = "csw_session_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

async function trackEvent(name: string, properties: Record<string, any> = {}) {
  try {
    const visitorId = getVisitorId();
    const traffic = classifyTraffic(visitorId);

    await supabase.from("events").insert({
      name,
      visitor_id: visitorId,
      session_id: getSessionId(),
      route: window.location.pathname,
      hostname: traffic.hostname,
      environment: traffic.environment,
      traffic_class: traffic.traffic_class,
      is_admin: traffic.is_admin,
      is_staff: traffic.is_staff,
      is_test: traffic.is_test,
      trace_tag: traffic.trace_tag,
      properties: {
        ...properties,
        ts: new Date().toISOString(),
      },
    } as any);
  } catch (e) {
    if (import.meta.env.DEV) console.debug("[DecisionTracking] Failed:", e);
  }
}

// ============ PAGE VIEW ============
export function trackPageView(meta?: Record<string, any>) {
  trackEvent("page_view", {
    route: window.location.pathname,
    referrer: document.referrer || null,
    ...meta,
  });
}

// ============ SHORTLIST ============
export function trackShortlistAdded(programId: string, meta?: Record<string, any>) {
  trackEvent("shortlist_added", {
    program_id: programId,
    ...meta,
  });
}

// ============ ENGAGED TIME ============
let engagedTimer: ReturnType<typeof setInterval> | null = null;
let engagedSeconds = 0;
let isPageVisible = true;

function handleVisibilityChange() {
  isPageVisible = !document.hidden;
}

export function startEngagedTimeTracking() {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  
  engagedTimer = setInterval(() => {
    if (isPageVisible) {
      engagedSeconds++;
    }
  }, 1000);

  // Send heartbeat every 30 seconds
  setInterval(() => {
    if (engagedSeconds > 0) {
      trackEvent("engaged_time_heartbeat", {
        engaged_seconds: engagedSeconds,
        route: window.location.pathname,
      });
    }
  }, 30000);

  // Send on unload
  window.addEventListener("beforeunload", () => {
    if (engagedSeconds > 0) {
      trackEvent("session_end", {
        total_engaged_seconds: engagedSeconds,
        route: window.location.pathname,
      });
    }
  });
}

export function stopEngagedTimeTracking() {
  if (engagedTimer) clearInterval(engagedTimer);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
}

// ============ SCROLL DEPTH ============
const scrollMilestones = new Set<number>();

export function trackScrollDepth() {
  const handler = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;

    const pct = Math.round((scrollTop / docHeight) * 100);
    const milestones = [25, 50, 75, 100];

    for (const m of milestones) {
      if (pct >= m && !scrollMilestones.has(m)) {
        scrollMilestones.add(m);
        trackEvent("scroll_depth", { depth: m, route: window.location.pathname });
      }
    }
  };

  window.addEventListener("scroll", handler, { passive: true });
  return () => window.removeEventListener("scroll", handler);
}

// ============ FUNNEL STEPS ============
export function trackFunnelStep(step: string, meta?: Record<string, any>) {
  trackEvent("funnel_step", { step, ...meta });
}

// ============ ENTITY VIEWS ============
export function trackEntityView(
  entityType: "university" | "program" | "country" | "scholarship",
  entityId: string,
  entitySlug: string,
  meta?: Record<string, any>
) {
  trackEvent("entity_view", {
    entity_type: entityType,
    entity_id: entityId,
    entity_slug: entitySlug,
    ...meta,
  });
}

// ============ SEARCH EVENTS ============
export function trackSearchPerformed(filters: Record<string, any>, resultCount: number) {
  trackEvent("search_performed", {
    filters,
    result_count: resultCount,
  });
}

export function trackSearchResultClick(entityType: string, entityId: string, position: number) {
  trackEvent("search_result_click", {
    entity_type: entityType,
    entity_id: entityId,
    position,
  });
}

// ============ REGISTRATION FUNNEL ============
export function trackRegisterStart() {
  trackEvent("register_start");
}

export function trackRegisterComplete() {
  trackEvent("register_complete");
}

export function trackDocUploaded(docType: string) {
  trackEvent("doc_uploaded", { doc_type: docType });
}

// ============ ACCOUNT FUNNEL ============
export function trackAccountOpen() {
  trackEvent("account_open");
}

export function trackServiceStepOpen(stepName: string) {
  trackEvent("service_step_open", { step: stepName });
}

// ============ REVENUE FUNNEL ============
export function trackApplicationSubmitted(applicationId?: string) {
  trackEvent("application_submitted", { application_id: applicationId });
}

export function trackPaymentStart(amount?: number, currency?: string) {
  trackEvent("payment_start", { amount, currency });
}

export function trackPaymentComplete(amount?: number, currency?: string) {
  trackEvent("payment_complete", { amount, currency });
}

export function trackPaymentFailed(reason?: string) {
  trackEvent("payment_failed", { reason });
}
