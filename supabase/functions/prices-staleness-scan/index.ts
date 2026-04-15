import { getSupabaseAdmin } from "../_shared/supabase.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const srv = getSupabaseAdmin();
    const staleDays = 90; // Mark as stale if older than 90 days

    // Update consensus records that haven't been updated in staleDays
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - staleDays);

    const { data, error } = await srv
      .from('tuition_consensus')
      .update({ is_stale: true })
      .lt('last_updated_at', staleDate.toISOString())
      .eq('is_stale', false)
      .select('id');

    if (error) throw error;

    const markedCount = data?.length || 0;

    console.log(`[prices-staleness-scan] Marked ${markedCount} consensus records as stale`);

    // Log telemetry
    await srv.from('events').insert({
      name: 'tuition_staleness_scan',
      visitor_id: 'system',
      properties: {
        marked_stale: markedCount,
        threshold_days: staleDays,
      },
    });

    return new Response(
      JSON.stringify({ ok: true, marked_stale: markedCount, threshold_days: staleDays }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[prices-staleness-scan] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
