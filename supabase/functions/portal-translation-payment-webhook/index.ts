import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// B3: Payment webhook handler (Stripe-style)
// SECURITY: ALWAYS verifies webhook signature - NO DEV MODE BYPASS
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    // SECURITY: Webhook secret MUST be configured - no exceptions
    if (!webhookSecret) {
      console.error('CRITICAL: STRIPE_WEBHOOK_SECRET not configured - rejecting webhook');
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');
    
    // SECURITY: Signature header MUST be present
    if (!signature) {
      console.error('Missing stripe-signature header');
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify signature with timing-safe comparison
    const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(rawBody);
    
    // Extract event details
    const eventId = event.id;
    const eventType = event.type;
    const paymentIntent = event.data?.object;
    
    if (!eventId || !eventType) {
      return new Response(
        JSON.stringify({ error: 'Invalid event format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing webhook event: ${eventType} (${eventId})`);

    // Map Stripe event to our status
    let status: string | null = null;
    let paymentId: string | null = null;
    
    // Extract our payment_id from metadata
    paymentId = paymentIntent?.metadata?.payment_id;
    
    switch (eventType) {
      case 'payment_intent.succeeded':
        status = 'succeeded';
        break;
      case 'payment_intent.payment_failed':
        status = 'failed';
        break;
      case 'charge.refunded':
        status = 'refunded';
        break;
      default:
        // Acknowledge but don't process unknown events
        console.log(`Ignoring event type: ${eventType}`);
        return new Response(
          JSON.stringify({ ok: true, message: 'Event type not handled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (!paymentId) {
      console.error('No payment_id in event metadata');
      return new Response(
        JSON.stringify({ error: 'Missing payment_id in metadata' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process via RPC (service role - only for webhooks)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await serviceClient.rpc('rpc_notarized_apply_payment_event', {
      p_provider: 'stripe',
      p_provider_event_id: eventId,
      p_event_type: eventType,
      p_payment_id: paymentId,
      p_status: status,
      p_provider_payment_id: paymentIntent?.id || null,
      p_raw_payload: event
    });

    if (error) {
      console.error('RPC error:', error);
      // Return 500 so Stripe retries
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Webhook processed: ${eventType}`, data);

    return new Response(
      JSON.stringify({ ok: true, ...data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do the comparison to maintain constant time
    // but we know it will fail
    let result = 1;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify Stripe webhook signature with:
 * - Support for multiple v1 signatures
 * - Timing-safe comparison
 * - Timestamp validation (5 minute window)
 */
async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  try {
    // Parse signature header: t=timestamp,v1=signature,v1=signature2,...
    const parts = signatureHeader.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
    
    // Collect ALL v1 signatures (Stripe may send multiple)
    const signatures = parts
      .filter(p => p.startsWith('v1='))
      .map(p => p.slice(3));
    
    if (!timestamp || signatures.length === 0) {
      console.error('Invalid signature header format');
      return false;
    }
    
    // Check timestamp (within 5 minutes / 300 seconds)
    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > 300) {
      console.error('Webhook timestamp outside tolerance window');
      return false;
    }
    
    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    );
    
    // Convert to hex
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Check against ALL v1 signatures using timing-safe comparison
    for (const sig of signatures) {
      if (timingSafeEqual(sig, expectedSig)) {
        return true;
      }
    }
    
    console.error('No matching v1 signature found');
    return false;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}
