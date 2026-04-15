import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

function getAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}


async function verifyWebhookSignature(rawBody: string, providedSignature: string | null): Promise<boolean> {
  const secret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[whatsapp-webhook] WHATSAPP_WEBHOOK_SECRET not configured');
    return false;
  }
  if (!providedSignature) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const rawSignature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(rawSignature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const normalized = providedSignature.startsWith('sha256=')
    ? providedSignature.slice(7).toLowerCase()
    : providedSignature.toLowerCase();
  return expected === normalized;
}

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\s+/g, '').replace(/^00/, '+');
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  return normalized;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('x-webhook-signature');

    if (!(await verifyWebhookSignature(rawBody, signatureHeader))) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = JSON.parse(rawBody);
    const { phone, message } = body;

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: 'phone and message required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getAdmin();
    const normalizedPhone = normalizePhone(phone);

    // 1) Get or create phone identity
    let { data: identity } = await supabase
      .from('phone_identities')
      .select('visitor_id')
      .eq('phone', normalizedPhone)
      .single();

    let visitorId: string;
    let isNewLead = false;

    if (!identity) {
      // New phone - create mapping
      visitorId = crypto.randomUUID();
      await supabase.from('phone_identities').insert([{ phone: normalizedPhone, visitor_id: visitorId }]);
      isNewLead = true;
    } else {
      visitorId = identity.visitor_id;
    }

    // 2) Get or create chat session
    let { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('visitor_id', visitorId)
      .eq('channel', 'whatsapp')
      .single();

    let sessionId: string;
    if (!session) {
      const { data: newSession } = await supabase
        .from('chat_sessions')
        .insert([{ visitor_id: visitorId, channel: 'whatsapp' }])
        .select('id')
        .single();
      sessionId = newSession!.id;
    } else {
      sessionId = session.id;
    }

    // 3) Save user message
    await supabase.from('chat_messages').insert([{
      session_id: sessionId,
      role: 'user',
      content: message,
    }]);

    // 4) Queue lead if new
    if (isNewLead) {
      await supabase.from('integration_events').insert([{
        event_name: 'lead.created',
        payload: { phone: normalizedPhone, channel: 'whatsapp', source: 'whatsapp_webhook', visitor_id: visitorId },
        idempotency_key: `lead:${normalizedPhone}:${new Date().toISOString().slice(0, 10)}`,
        status: 'queued',
      }]);
    }

    // 5) Log event
    await supabase.from('events').insert([{
      name: 'whatsapp_message_received',
      session_id: sessionId,
      visitor_id: visitorId,
      properties: { phone: normalizedPhone, is_new_lead: isNewLead },
    }]);

    return new Response(JSON.stringify({
      ok: true,
      session_id: sessionId,
      visitor_id: visitorId,
      is_new_lead: isNewLead,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});