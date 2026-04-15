import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { 
      user_id = null, 
      session_id = null, 
      tab, 
      event, 
      payload = null, 
      latency_ms = null, 
      route = null 
    } = await req.json();

    if (!tab || !event) {
      throw new Error("Missing required fields: tab and event");
    }

    const ip = req.headers.get("x-forwarded-for") || 
               req.headers.get("cf-connecting-ip") || 
               null;

    const { error } = await supabase.from("analytics_events").insert({
      user_id,
      session_id,
      tab,
      event,
      payload,
      latency_ms,
      route,
      ip
    });

    if (error) throw error;

    console.log(`[track-event] ${tab}:${event} ${latency_ms ? `(${latency_ms}ms)` : ''}`);

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error("[track-event] Error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
