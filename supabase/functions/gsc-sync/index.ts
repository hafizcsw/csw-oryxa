import { requireAdmin } from "../_shared/adminGuard.ts";
import { getGscAccessToken, fetchSearchAnalytics } from "../_shared/gscClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const g = await requireAdmin(req);
    if (!g.ok) {
      return new Response(JSON.stringify({ ok: false, error: g.error }), {
        status: g.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if GSC sync is enabled
    const { data: flagData } = await g.srv
      .from("feature_settings")
      .select("value")
      .eq("key", "gsc_sync_enabled")
      .single();
    
    if (flagData?.value === "false") {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "GSC sync is disabled" 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    
    // Load GSC settings from database
    const { data: settingsData } = await g.srv
      .from("feature_settings")
      .select("key, value")
      .in("key", ["gsc_sa_email", "gsc_sa_private_key", "gsc_property"]);
    
    const settings: any = {};
    (settingsData || []).forEach(s => { settings[s.key] = s.value; });

    const property = body.property || settings.gsc_property;
    const days = body.days ?? 28;

    if (!settings.gsc_sa_email || !settings.gsc_sa_private_key || !property) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "GSC credentials not configured. Please configure in GSC settings." 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get access token
    const token = await getGscAccessToken(settings.gsc_sa_email, settings.gsc_sa_private_key);

    // Fetch analytics
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    const report = await fetchSearchAnalytics(property, since, until, token);

    // Save snapshot
    const { error } = await g.srv.from("gsc_snapshots").insert({
      property,
      clicks: report.clicks,
      impressions: report.impressions,
      ctr: report.ctr,
      position: report.position,
      top_queries: report.top_queries,
      top_pages: report.top_pages
    });

    if (error) throw error;

    // Log telemetry
    await g.srv.from("events").insert({
      name: "gsc_synced",
      properties: {
        clicks: report.clicks,
        impressions: report.impressions,
        ctr: report.ctr,
        position: report.position,
        reason: body.reason || "manual"
      }
    });

    return new Response(JSON.stringify({ ok: true, saved: true, summary: report }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("[gsc-sync] Exception:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
