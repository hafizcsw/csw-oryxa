import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const guard = await requireAdmin(req);
  if (!guard.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: guard.error }),
      { status: guard.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {

    const body = await req.json();
    const allowedKeys = new Set(['crm_webhook_url', 'crm_auth_header', 'crm_timeout_ms', 'crm_max_retries']);

    for (const [key, value] of Object.entries(body || {})) {
      if (!allowedKeys.has(key)) continue;
      
      await supabase.from('feature_settings').upsert({
        key,
        value: value as any
      });
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
