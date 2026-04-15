// LAV #15.5: Health & Observability Endpoint
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-store'
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  const ts = new Date().toISOString();
  let overall_ok = true;
  const checks: Record<string, boolean> = {};

  try {
    // Check 1: DB Connection
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from('settings').select('id').limit(1);
      checks.db_connection = !error;
      if (error) overall_ok = false;
    } else {
      checks.db_connection = false;
      overall_ok = false;
    }

    // Check 2: Secrets Present
    checks.secrets_present = !!(
      Deno.env.get('SUPABASE_URL') &&
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );
    if (!checks.secrets_present) overall_ok = false;

    // Check 3: pgcrypto
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.rpc('test_crypto_basic');
      checks.pgcrypto_enabled = !error && !!data;
      if (error) overall_ok = false;
    } else {
      checks.pgcrypto_enabled = false;
    }

    return new Response(
      JSON.stringify({
        overall_ok,
        ts,
        checks,
        version: '1.0.0',
        service: 'wa-provider-health'
      }),
      {
        status: overall_ok ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    overall_ok = false;
    return new Response(
      JSON.stringify({
        overall_ok,
        ts,
        checks,
        error: String(error),
        service: 'wa-provider-health'
      }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
