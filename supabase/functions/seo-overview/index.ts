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

    const url = new URL(req.url);
    const countrySlug = url.searchParams.get('country');

    // Use the new seo_overview_summary function
    const { data: summary, error } = await g.srv.rpc('seo_overview_summary', {
      _country_slug: countrySlug
    });

    if (error) throw error;

    // Get GSC daily chart data
    const { data: gscDaily } = await g.srv
      .from('seo_gsc_daily')
      .select('date, impressions, clicks')
      .gte('date', new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Get top pages from GSC
    const { data: gscRecent } = await g.srv
      .from('seo_gsc_daily')
      .select('page, impressions, clicks')
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('clicks', { ascending: false })
      .limit(10);

    // Aggregate chart data
    const chartData = gscDaily?.reduce((acc: any[], d) => {
      const existing = acc.find(x => x.date === d.date);
      if (existing) {
        existing.impressions += d.impressions || 0;
        existing.clicks += d.clicks || 0;
      } else {
        acc.push({
          date: d.date,
          impressions: d.impressions || 0,
          clicks: d.clicks || 0,
        });
      }
      return acc;
    }, []) || [];

    const result = {
      ok: true,
      summary,
      top_pages: gscRecent || [],
      chart_data: chartData,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error('[seo-overview] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
