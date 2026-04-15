import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * PORTAL-EVIDENCE: Fetch telemetry audit data from CRM
 * Returns 5 Evidence Queries for Portal-CRM sync verification
 * 
 * Expected by admin dashboard to verify:
 * 1. Zero legacy channels (web, unknown)
 * 2. Correct ACK distribution (web_chat vs web_portal)
 * 3. 100% entry_fn presence
 * 4. Zero channel/stamps.channel mismatches
 * 5. Consistent client_build presence
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { minutes = 60 } = await req.json();

    // ✅ SECURITY: Verify admin auth on server
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ SECURITY: Check if user is admin
    const { data: adminCheck, error: adminError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (adminError || !adminCheck) {
      console.warn('[portal-evidence] ⚠️ Non-admin user attempted evidence retrieval:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[portal-evidence] 🔐 Admin verified:', user.id.slice(0, 8) + '...');

    // Get CRM config
    const CRM_FUNCTIONS_URL = Deno.env.get('CRM_FUNCTIONS_URL');
    const CRM_API_KEY = Deno.env.get('CRM_API_KEY');

    if (!CRM_FUNCTIONS_URL || !CRM_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'CRM not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[portal-evidence] 📊 Fetching telemetry evidence from CRM (last', minutes, 'minutes)');
    const traceId = `evidence_${Date.now().toString(36)}`;

    // Call CRM evidence endpoint
    const evidenceResponse = await fetch(`${CRM_FUNCTIONS_URL}/web-chat-malak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CRM_API_KEY,
        'x-orxya-ingress': 'portal', // Internal trust header
        'x-client-trace-id': traceId,
        'x-portal-proxy-secret': Deno.env.get('PORTAL_PROXY_SECRET') || '',
      },
      body: JSON.stringify({
        type: 'evidence',
        minutes: minutes,
      }),
    });

    if (!evidenceResponse.ok) {
      const errorText = await evidenceResponse.text();
      console.error('[portal-evidence] ❌ CRM error:', evidenceResponse.status, errorText);
      throw new Error(`CRM returned ${evidenceResponse.status}: ${errorText}`);
    }

    const evidence = await evidenceResponse.json();

    console.log('[portal-evidence] ✅ Evidence retrieved:', {
      q1_legacy_channels: evidence.query_1?.rows?.length || 0,
      q2_rejected_invalid: evidence.query_2?.rows?.length || 0,
      q3_mismatches: evidence.query_3?.rows?.length || 0,
      q4_entry_fn: evidence.query_4?.summary,
      q5_guards: evidence.query_5?.rows?.length || 0,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        fetched_at: new Date().toISOString(),
        minutes,
        evidence,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (e) {
    console.error('[portal-evidence] ❌ Error:', e);
    return new Response(
      JSON.stringify({ 
        ok: false,
        error: String(e)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
