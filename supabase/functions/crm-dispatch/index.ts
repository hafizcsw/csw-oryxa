// ============================================================================
// LEGACY INTEGRATION: CRM Dispatch (Webhook-based)
// ============================================================================
// This Edge Function implements an older webhook-based CRM integration pattern.
// It is DISABLED by default and only runs if CRM_LEGACY_MODE=true.
//
// The PRIMARY integration used in production is:
//   - Direct Supabase Functions calls via crmClient.ts
//   - Functions: web-sync-student, web-sync-application, orchestrate-chat
//   - Settings: CRM_FUNCTIONS_URL + CRM_API_KEY
//   - No integration_outbox table involved
//
// This function is kept for reference but not actively used.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getSettings(supabase: any) {
  // Get feature flag from feature_flags table
  const { data: flagData } = await supabase.from("feature_flags").select("value").eq("key", "crm_enabled").single();
  
  // Get settings from feature_settings table
  const { data: settingsData } = await supabase.from("feature_settings").select("key,value");
  const map: any = Object.fromEntries((settingsData || []).map((r: any) => [r.key, r.value]));
  
  return {
    enabled: !!flagData?.value?.enabled,
    url: map["crm_webhook_url"]?.url || "",
    header: map["crm_auth_header"]?.header || "Authorization",
    token: map["crm_auth_header"]?.value || "",
    timeout: Number(map["crm_timeout_ms"]?.value || 5000),
    maxRetries: Number(map["crm_max_retries"]?.value || 5)
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // ✅ تعطيل Legacy dispatch افتراضياً
  const LEGACY_MODE_ENABLED = Deno.env.get('CRM_LEGACY_MODE') === 'true';
  
  if (!LEGACY_MODE_ENABLED) {
    console.log('[crm-dispatch] Legacy mode is disabled. Skipping dispatch.');
    return new Response(
      JSON.stringify({ 
        ok: true, 
        skipped: true, 
        reason: "Legacy CRM dispatch is disabled. Using direct Supabase Functions integration (CSW AI CRM)." 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { only_one = false } = await req.json().catch(() => ({}));
    const cfg = await getSettings(supabase);

    if (!cfg.enabled || !cfg.url) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: "CRM disabled or URL not set" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch pending items
    const { data: items } = await supabase
      .from("integration_outbox")
      .select("*")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(only_one ? 1 : 10);

    if (!items?.length) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sent = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), cfg.timeout);

        const res = await fetch(cfg.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [cfg.header]: cfg.token
          },
          body: JSON.stringify({ event: item.event_type, data: item.payload }),
          signal: ctrl.signal
        });

        clearTimeout(timeout);

        // Treat 409 (Conflict/Idempotent) as success
        const isSuccess = res.ok || res.status === 409;
        
        if (!isSuccess) throw new Error(`CRM responded with ${res.status}`);

        await supabase
          .from("integration_outbox")
          .update({ 
            status: "sent", 
            attempts: item.attempts + 1, 
            last_error: null 
          })
          .eq("id", item.id);

        sent++;
        console.log(`[crm-dispatch] Successfully sent event ${item.id}`);
      } catch (e: any) {
        const attempts = item.attempts + 1;
        const err = String(e?.message || e);
        const backoffMin = Math.min(60, Math.pow(2, attempts)); // Exponential backoff (max 60 minutes)
        const next = new Date(Date.now() + backoffMin * 60 * 1000).toISOString();
        const status = attempts >= cfg.maxRetries ? "error" : "pending";

        await supabase
          .from("integration_outbox")
          .update({
            status,
            attempts,
            last_error: err,
            next_attempt_at: next
          })
          .eq("id", item.id);

        failed++;
        console.error(`[crm-dispatch] Failed to send event ${item.id}: ${err}`);
      }

      if (only_one) break;
    }

    return new Response(
      JSON.stringify({ ok: true, sent, failed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[crm-dispatch] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
