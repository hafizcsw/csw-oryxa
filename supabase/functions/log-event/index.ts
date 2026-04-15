import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      name, session_id, visitor_id, properties,
      hostname, environment, traffic_class, is_admin, is_test 
    } = await req.json();
    
    if (!name) {
      return new Response(
        JSON.stringify({ error: 'name required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getAdmin();
    const { error } = await supabase
      .from('events')
      .insert([{ 
        name, 
        session_id, 
        visitor_id, 
        properties,
        hostname: hostname || null,
        environment: environment || 'prod',
        traffic_class: traffic_class || 'real',
        is_admin: is_admin || false,
        is_test: is_test || false,
      }]);

    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ ok: true }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('log-event error:', e);
    return new Response(
      JSON.stringify({ error: 'internal', detail: String(e) }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
