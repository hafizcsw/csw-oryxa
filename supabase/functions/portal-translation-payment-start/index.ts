import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * B2: Start payment session for accepted quote
 * 
 * SECURITY: Uses authenticated user's JWT - ownership checked in RPC
 * 
 * Supports two providers:
 * - mock: Returns payment details without Stripe (for testing)
 * - stripe: Creates Stripe checkout session (production)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use authenticated client - NOT service role
    // Ownership is enforced in the SECURITY DEFINER RPC
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { quote_id, idempotency_key } = body;

    if (!quote_id) {
      return new Response(
        JSON.stringify({ error: 'quote_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call RPC with authenticated user context
    // The RPC is SECURITY DEFINER and checks auth.uid() internally
    const { data, error } = await supabase.rpc('rpc_notarized_payment_start', {
      p_quote_id: quote_id,
      p_idempotency_key: idempotency_key || null
    });

    if (error) {
      console.error('RPC error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for RPC-level errors
    if (data?.error) {
      const statusCode = data.code === 'AUTH_REQUIRED' || data.code === 'NOT_OWNER' ? 403 : 400;
      return new Response(
        JSON.stringify({ error: data.error, code: data.code }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine provider mode
    const PAYMENTS_PROVIDER = Deno.env.get('PAYMENTS_PROVIDER') || 'mock';
    
    console.log(`Payment started for quote: ${quote_id}, provider: ${PAYMENTS_PROVIDER}`, data);

    // For mock provider, return payment details without Stripe
    if (PAYMENTS_PROVIDER === 'mock') {
      return new Response(
        JSON.stringify({
          ...data,
          provider: 'mock',
          // No checkout_url - user will use "Simulate Payment" button
          mock_mode: true,
          // Use i18n key instead of raw text
          instructions_key: 'payment.mockModeInstructions'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For Stripe provider, create checkout session
    // TODO: Implement Stripe checkout when secrets are configured
    return new Response(
      JSON.stringify({
        ...data,
        provider: 'stripe',
        // checkout_url would come from Stripe API
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
