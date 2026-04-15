// Deno.serve is used directly — no import needed
import { corsHeaders } from '../_shared/auth.ts';
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const INTEGRATION_ENABLED = Deno.env.get('INTEGRATION_ENABLED') === 'true';
    const CRM_URL = Deno.env.get('CRM_URL');

    if (!INTEGRATION_ENABLED || !CRM_URL) {
      return new Response(JSON.stringify({ 
        ok: true, 
        sent: 0, 
        message: 'Integration disabled or CRM_URL not configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // Get queued events
    const { data: events, error: fetchError } = await supabase
      .from('integration_events')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError || !events) {
      console.error('Fetch events error:', fetchError);
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;

    for (const event of events) {
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
            .eq('id', event.id);
          sent++;
        } else {
          const errorText = await response.text();
          await supabase
            .from('integration_events')
            .update({ status: 'error', last_error: errorText.slice(0, 500) })
            .eq('id', event.id);
        }
      } catch (netError) {
        const errorMsg = netError instanceof Error ? netError.message : 'Network error';
        await supabase
          .from('integration_events')
          .update({ status: 'error', last_error: errorMsg.slice(0, 500) })
          .eq('id', event.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Request error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
