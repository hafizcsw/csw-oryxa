import { requireAdmin } from "../_shared/adminGuard.ts";

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

    const { property_url, svc_email, svc_key_pem, is_daily_sync, is_bk_auto } = await req.json();

    if (!property_url || !svc_email || !svc_key_pem) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'Missing required fields' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Upsert config
    const { error } = await g.srv
      .from('seo_gsc_config')
      .upsert({
        property_url,
        svc_email,
        svc_key_pem,
        is_daily_sync: !!is_daily_sync,
        is_bk_auto: !!is_bk_auto,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'property_url'
      });

    if (error) throw error;

    // Log telemetry
    await g.srv.from('events').insert({
      name: 'seo_gsc_config_saved',
      properties: { property_url, is_daily_sync, is_bk_auto }
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("[admin-seo-gsc-save] Error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
