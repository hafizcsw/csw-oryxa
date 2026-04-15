import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifyAdminJWT, corsHeaders } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

async function signHmac(body: string): Promise<string> {
  const secret = Deno.env.get('HMAC_SHARED_SECRET') || '';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await verifyAdminJWT(req.headers.get('authorization'));
    if (!payload) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // Get integration event
    const { data: event, error: fetchError } = await supabase
      .from('integration_events')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const CRM_URL = Deno.env.get('CRM_URL');
    if (!CRM_URL) {
      return new Response(JSON.stringify({ error: 'CRM_URL not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bodyStr = JSON.stringify(event.payload);
    const signature = await signHmac(bodyStr);

    try {
      const response = await fetch(CRM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSW-Event': event.event_name,
          'X-CSW-Idempotency-Key': event.idempotency_key,
          'X-CSW-Signature': signature,
        },
        body: bodyStr,
      });

      if (response.ok) {
        await supabase
          .from('integration_events')
          .update({ status: 'acked', last_error: null })
          .eq('id', id);

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        const errorText = await response.text();
        await supabase
          .from('integration_events')
          .update({ status: 'error', last_error: errorText.slice(0, 500) })
          .eq('id', id);

        return new Response(JSON.stringify({ ok: false, error: 'CRM request failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (netError) {
      const errorMsg = netError instanceof Error ? netError.message : 'Network error';
      await supabase
        .from('integration_events')
        .update({ status: 'error', last_error: errorMsg.slice(0, 500) })
        .eq('id', id);

      return new Response(JSON.stringify({ ok: false, error: 'Network error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Request error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
