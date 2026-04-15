import { requireAdminOrServiceRole } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const auth = await requireAdminOrServiceRole(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ ok: false, error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = auth.srv;

    // 1) KPIs - results last 24h, apply last 7d
    const { count: events24h } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event', 'results_loaded')
      .gte('at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { count: apply7d } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event', 'apply_submitted')
      .gte('at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // 2) Latency per tab (last 7 days)
    const { data: latencyData } = await supabase
      .from('analytics_events')
      .select('tab, latency_ms')
      .eq('event', 'results_loaded')
      .not('latency_ms', 'is', null)
      .gte('at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // Calculate p50/p95 per tab
    const tabLatency = new Map<string, number[]>();
    (latencyData || []).forEach((row: any) => {
      const tab = row.tab || 'unknown';
      if (!tabLatency.has(tab)) tabLatency.set(tab, []);
      tabLatency.get(tab)!.push(row.latency_ms);
    });

    const latency = Array.from(tabLatency.entries()).map(([tab, values]) => {
      values.sort((a, b) => a - b);
      const p50 = values[Math.floor(values.length * 0.5)] || 0;
      const p95 = values[Math.floor(values.length * 0.95)] || 0;
      return { tab, p50_ms: Math.round(p50), p95_ms: Math.round(p95), n: values.length };
    }).sort((a, b) => b.p95_ms - a.p95_ms);

    // 3) Event counts (last 7 days)
    const targetEvents = ['filter_changed', 'results_loaded', 'shortlist_add', 'shortlist_remove', 'apply_submitted'];
    const { data: eventsData } = await supabase
      .from('analytics_events')
      .select('event')
      .in('event', targetEvents)
      .gte('at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const eventCounts = new Map<string, number>();
    (eventsData || []).forEach((row: any) => {
      eventCounts.set(row.event, (eventCounts.get(row.event) || 0) + 1);
    });
    const events = Array.from(eventCounts.entries())
      .map(([event, n]) => ({ event, n }))
      .sort((a, b) => b.n - a.n);

    // 4) Timeseries (last 14 days)
    const { data: seriesData } = await supabase
      .from('analytics_events')
      .select('at, tab')
      .eq('event', 'results_loaded')
      .gte('at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());

    const seriesMap = new Map<string, Map<string, number>>();
    (seriesData || []).forEach((row: any) => {
      const day = new Date(row.at).toISOString().slice(0, 10);
      const tab = row.tab || 'unknown';
      if (!seriesMap.has(day)) seriesMap.set(day, new Map());
      const dayMap = seriesMap.get(day)!;
      dayMap.set(tab, (dayMap.get(tab) || 0) + 1);
    });

    const series: { day: string; tab: string; events: number }[] = [];
    seriesMap.forEach((tabs, day) => {
      tabs.forEach((count, tab) => {
        series.push({ day, tab, events: count });
      });
    });
    series.sort((a, b) => a.day.localeCompare(b.day));

    // 5) Conversion by country (filter -> results)
    const { data: filterData } = await supabase
      .from('analytics_events')
      .select('session_id, tab, route, at, payload')
      .eq('event', 'filter_changed')
      .gte('at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const { data: resultsData } = await supabase
      .from('analytics_events')
      .select('session_id, tab, route, at')
      .eq('event', 'results_loaded')
      .gte('at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const convMap = new Map<string, { filter_hits: number; results_hits: number }>();
    (filterData || []).forEach((f: any) => {
      const country = (f.payload?.country || '(none)').toString();
      if (!convMap.has(country)) {
        convMap.set(country, { filter_hits: 0, results_hits: 0 });
      }
      const entry = convMap.get(country)!;
      entry.filter_hits++;

      // Check if there's a matching result within 10 minutes
      const fTime = new Date(f.at).getTime();
      const hasResult = (resultsData || []).some((r: any) => {
        return r.session_id === f.session_id &&
               r.tab === f.tab &&
               r.route === f.route &&
               Math.abs(new Date(r.at).getTime() - fTime) <= 10 * 60 * 1000;
      });
      if (hasResult) entry.results_hits++;
    });

    const conv = Array.from(convMap.entries())
      .map(([country, stats]) => ({ country, ...stats }))
      .sort((a, b) => b.results_hits - a.results_hits || b.filter_hits - a.filter_hits)
      .slice(0, 12);

    return new Response(
      JSON.stringify({
        ok: true,
        kpi: {
          results_24h: events24h || 0,
          apply_7d: apply7d || 0
        },
        latency,
        events,
        series,
        conv
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60'
        }
      }
    );
  } catch (e: any) {
    console.error('[get-telemetry-dashboard] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
