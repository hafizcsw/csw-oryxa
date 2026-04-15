import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Mock Payment Simulate Endpoint
 * 
 * SECURITY:
 * - Requires authenticated user JWT (not service role)
 * - Ownership verified via RPC (user must own the quote/order)
 * - Idempotency enforced via unique constraint on provider_event_id
 * - Only works when PAYMENTS_PROVIDER !== 'stripe'
 * 
 * This simulates the same flow as Stripe webhook but triggered by user action
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Check if mock payments are enabled
    const PAYMENTS_PROVIDER = Deno.env.get('PAYMENTS_PROVIDER') || 'mock';
    if (PAYMENTS_PROVIDER === 'stripe') {
      return new Response(
        JSON.stringify({ error: 'Mock payments disabled in production mode' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Require authenticated user - NOT service role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { payment_id, simulate_status = 'succeeded', provider_event_id: customEventId } = body;

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: 'payment_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate simulate_status
    const validStatuses = ['succeeded', 'failed', 'refunded'];
    if (!validStatuses.includes(simulate_status)) {
      return new Response(
        JSON.stringify({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Check for ALLOW_MOCK_PAYMENTS
    // Accepts 'true', '1', or any truthy non-empty value
    const ALLOW_MOCK_PAYMENTS = (Deno.env.get('ALLOW_MOCK_PAYMENTS') || '').trim().toLowerCase();
    const isMockAllowed = ALLOW_MOCK_PAYMENTS === 'true' || ALLOW_MOCK_PAYMENTS === '1' || ALLOW_MOCK_PAYMENTS.length > 0;
    // Safe logging: only boolean result, never the value
    console.log(`[SECURITY] ALLOW_MOCK_PAYMENTS check: allowed=${isMockAllowed}, length=${ALLOW_MOCK_PAYMENTS.length}`);
    
    if (!isMockAllowed) {
      console.error('[SECURITY] Mock payments blocked - ALLOW_MOCK_PAYMENTS must be set');
      return new Response(
        JSON.stringify({ error: 'Mock payments not enabled on this environment' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for RPC that checks ownership internally
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // First verify ownership - payment must belong to this user's quote/order
    const { data: payment, error: paymentError } = await serviceClient
      .from('notarized_payments')
      .select(`
        id,
        quote_id,
        status,
        notarized_translation_quotes (
          order_id,
          notarized_translation_orders (
            customer_id
          )
        )
      `)
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found:', paymentError);
      return new Response(
        JSON.stringify({ error: 'Payment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Ownership check - user must own this payment
    // Navigate through the join: payment -> quote -> order -> customer_id
    const quoteInfo = payment.notarized_translation_quotes;
    const quoteData = Array.isArray(quoteInfo) ? quoteInfo[0] : quoteInfo;
    const orderInfo = quoteData?.notarized_translation_orders;
    const orderData = Array.isArray(orderInfo) ? orderInfo[0] : orderInfo;
    const customerId = orderData?.customer_id;
    
    if (!customerId || customerId !== user.id) {
      console.error(`Ownership violation: user ${user.id} tried to simulate payment for customer ${customerId}`);
      return new Response(
        JSON.stringify({ error: 'Not authorized to simulate this payment' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // (ALLOW_MOCK_PAYMENTS already checked above - no duplicate needed)

    // Build the event ID first - needed for true idempotency check
    const mockEventId = customEventId || `mock_${payment_id}_${simulate_status}`;
    console.log(`[IDEMPOTENCY] Using event_id: ${mockEventId}, custom=${!!customEventId}`);

    // TRUE IDEMPOTENCY: Check if this exact event was already processed
    // This allows proper idempotent responses even after payment status changed
    const { data: existingEvent } = await serviceClient
      .from('notarized_payment_provider_events')
      .select('id')
      .eq('provider_event_id', mockEventId)
      .maybeSingle();

    if (existingEvent) {
      console.log(`[IDEMPOTENCY] Event ${mockEventId} already processed - returning idempotent response`);
      return new Response(
        JSON.stringify({ 
          ok: true, 
          idempotent: true,
          payment_id,
          mock_event_id: mockEventId,
          message: 'Event already processed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check payment is in pending state (only if not already processed)
    if (payment.status !== 'pending') {
      return new Response(
        JSON.stringify({ 
          error: 'Payment already processed',
          current_status: payment.status 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get quote and order status for additional validation
    const { data: quote, error: quoteError } = await serviceClient
      .from('notarized_translation_quotes')
      .select('status, order_id')
      .eq('id', payment.quote_id)
      .single();

    if (quoteError || !quote) {
      return new Response(
        JSON.stringify({ error: 'Quote not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (quote.status !== 'accepted') {
      return new Response(
        JSON.stringify({ error: 'Quote must be accepted before payment simulation', quote_status: quote.status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: order, error: orderError } = await serviceClient
      .from('notarized_translation_orders')
      .select('status')
      .eq('id', quote.order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.status !== 'awaiting_payment') {
      return new Response(
        JSON.stringify({ error: 'Order must be awaiting_payment', order_status: order.status }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // (mockEventId already defined above for idempotency check)

    // Map simulate_status to event_type (like Stripe would send)
    const eventTypeMap: Record<string, string> = {
      'succeeded': 'payment_intent.succeeded',
      'failed': 'payment_intent.payment_failed',
      'refunded': 'charge.refunded'
    };

    // Call the same RPC that webhook would call
    const { data: result, error: rpcError } = await serviceClient.rpc(
      'rpc_notarized_apply_payment_event',
      {
        p_provider: 'mock',
        p_provider_event_id: mockEventId,
        p_event_type: eventTypeMap[simulate_status],
        p_payment_id: payment_id,
        p_status: simulate_status,
        p_provider_payment_id: `mock_pi_${payment_id.slice(0, 8)}`,
        p_raw_payload: {
          simulated: true,
          user_id: user.id,
          timestamp: new Date().toISOString()
        }
      }
    );

    if (rpcError) {
      // Check for idempotent duplicate (unique_violation on provider_event_id)
      if (rpcError.message?.includes('unique_violation') || rpcError.message?.includes('duplicate')) {
        console.log(`Idempotent: event ${mockEventId} already processed`);
        return new Response(
          JSON.stringify({ 
            ok: true, 
            idempotent: true,
            payment_id,
            mock_event_id: mockEventId,
            message: 'Event already processed'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('RPC error:', rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if RPC returned idempotent flag
    if (result?.idempotent) {
      console.log(`Idempotent: payment ${payment_id} already in ${simulate_status} state`);
      return new Response(
        JSON.stringify({ 
          ok: true, 
          idempotent: true,
          payment_id,
          mock_event_id: mockEventId,
          ...result 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Mock payment simulated: ${payment_id} → ${simulate_status} by user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        idempotent: false,
        payment_id,
        new_status: simulate_status,
        mock_event_id: mockEventId,
        ...result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Simulate error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
