import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csw-signature',
};

async function verifySignature(body: string, sig: string | null): Promise<boolean> {
  const secret = Deno.env.get('CRM_INBOUND_HMAC_SECRET') || '';
  if (!secret || !sig) return false;
  
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const raw = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const hex = Array.from(new Uint8Array(raw))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return hex === sig.toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const sig = req.headers.get('x-csw-signature');

    if (!(await verifySignature(body, sig))) {
      console.error('[crm-callback] Invalid signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.parse(body);
    const { application_id, status, note, actor } = payload || {};

    if (!application_id || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[crm-callback] Processing:', { application_id, status, actor });

    // Call SQL function
    const { error } = await supabase.rpc('app_add_status', {
      p_application_id: application_id,
      p_status: status,
      p_note: note || null,
      p_created_by: actor || 'crm'
    });

    if (error) {
      console.error('[crm-callback] RPC error:', error);
      throw error;
    }

    console.log('[crm-callback] Status updated successfully');

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[crm-callback] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
