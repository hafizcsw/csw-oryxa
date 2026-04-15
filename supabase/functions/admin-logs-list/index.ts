import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const s = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function J(d: any, st = 200) {
  return new Response(JSON.stringify(d), {
    status: st,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const guard = await requireAdmin(req);
  if (!guard.ok) return J({ ok: false, error: guard.error }, guard.status);

  try {
    // Get integration events logs
    const { data: events } = await s
      .from("integration_events")
      .select("id, created_at, event_name, target, status, last_error, payload")
      .order("created_at", { ascending: false })
      .limit(100);

    // Get analytics events for CRM/WhatsApp dispatches
    const { data: analytics } = await s
      .from("analytics_events")
      .select("id, at, event, latency_ms, payload")
      .in("event", [
        "crm_dispatch_sent",
        "crm_dispatch_error",
        "whatsapp_dispatch_sent",
        "whatsapp_dispatch_error"
      ])
      .order("at", { ascending: false })
      .limit(100);

    // Combine and sort by timestamp
    const allLogs = [
      ...(events || []).map(e => ({
        id: e.id,
        timestamp: e.created_at,
        type: "integration_event",
        event: e.event_name,
        target: e.target,
        status: e.status,
        error: e.last_error,
        payload: e.payload,
      })),
      ...(analytics || []).map(a => ({
        id: a.id,
        timestamp: a.at,
        type: "analytics_event",
        event: a.event,
        latency_ms: a.latency_ms,
        payload: a.payload,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return J({ ok: true, items: allLogs.slice(0, 100) });
  } catch (error: any) {
    console.error("Error fetching logs:", error);
    return J({ ok: false, error: String(error) }, 500);
  }
});
