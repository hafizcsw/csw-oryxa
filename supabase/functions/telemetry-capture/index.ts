import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { event_name, meta = {}, visitor_id, user_id, session_id } = await req.json();

    if (!event_name) {
      return new Response(
        JSON.stringify({ ok: false, error: 'event_name required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map event_name to the correct column 'event' and calculate required fields
    const eventData: any = {
      tab: 'bot',  // Default tab for bot telemetry
      event: event_name,
      payload: meta,
      route: meta.route || null,
      latency_ms: meta.latency_ms ? Math.round(meta.latency_ms) : null,
      session_id: session_id || null,
      user_id: user_id || null,
    };

    const { error } = await supabase
      .from('analytics_events')
      .insert(eventData);

    if (error) {
      console.error('[telemetry-capture] Insert error:', error);
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[telemetry-capture] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
