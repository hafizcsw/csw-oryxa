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

    // TODO: Implement Google Search Console API integration
    // For now, insert demo data for testing
    const demoData = [];
    const today = new Date();
    
    for (let i = 0; i < 28; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      demoData.push({
        date: dateStr,
        page: '/',
        country_slug: null,
        clicks: Math.floor(Math.random() * 50) + 10,
        impressions: Math.floor(Math.random() * 500) + 100,
        ctr: Number((Math.random() * 10 + 2).toFixed(2)),
        position: Number((Math.random() * 15 + 5).toFixed(2))
      });
    }

    const { error } = await g.srv.from('seo_gsc_daily').insert(demoData);
    if (error) throw error;

    // Log event
    await g.srv.from('analytics_events').insert({
      event: 'gsc_sync_completed',
      payload: { records_inserted: demoData.length }
    });

    return new Response(
      JSON.stringify({ ok: true, inserted: demoData.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error('[gsc-sync-daily] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
