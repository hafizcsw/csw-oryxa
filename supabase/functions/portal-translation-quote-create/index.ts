import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    const { order_id, country_code = 'RU' } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[quote-create] Starting quote calculation', { order_id, country_code, user_id: user.id });

    // ✅ Use the NEW unified pricing RPC (rpc_notarized_quote_calc)
    // This RPC validates ownership internally and calculates VAT
    const { data: calcResult, error: calcError } = await supabase.rpc('rpc_notarized_quote_calc', {
      p_order_id: order_id,
      p_country_code: country_code
    });

    if (calcError) {
      console.error('[quote-create] RPC calc error:', calcError);
      return new Response(
        JSON.stringify({ error: calcError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!calcResult?.ok) {
      console.error('[quote-create] Pricing calculation failed:', calcResult);
      return new Response(
        JSON.stringify({ 
          error: calcResult?.error || 'pricing_calculation_failed',
          missing_slots: calcResult?.missing_slots 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[quote-create] Calculation result:', calcResult);

    // Now create/update the quote record using service role
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check if quote already exists for this order
    const { data: existingQuote } = await serviceClient
      .from('notarized_translation_quotes')
      .select('id')
      .eq('order_id', order_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const breakdown = {
      version: 1,
      line_items: calcResult.line_items,
      subtotal_minor: calcResult.subtotal_minor,
      vat_minor: calcResult.vat_minor,
      vat_rate: calcResult.vat_rate,
    };

    let quoteId: string;

    if (existingQuote?.id) {
      // Update existing quote (idempotent)
      // ✅ FIX: Use 'presented' status (matches DB constraint)
      const { error: updateError } = await serviceClient
        .from('notarized_translation_quotes')
        .update({
          total_amount: calcResult.total_minor,
          currency: calcResult.currency,
          breakdown_json: breakdown,
          status: 'presented',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingQuote.id);

      if (updateError) {
        console.error('[quote-create] Update error:', updateError);
        throw updateError;
      }

      quoteId = existingQuote.id;
      console.log('[quote-create] Quote updated:', quoteId);
    } else {
      // Create new quote
      // ✅ FIX: Use 'presented' status (matches DB constraint)
      const { data: newQuote, error: insertError } = await serviceClient
        .from('notarized_translation_quotes')
        .insert({
          order_id,
          total_amount: calcResult.total_minor,
          currency: calcResult.currency,
          breakdown_json: breakdown,
          status: 'presented',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[quote-create] Insert error:', insertError);
        throw insertError;
      }

      quoteId = newQuote.id;
      console.log('[quote-create] Quote created:', quoteId);

      // Log event
      await serviceClient.from('notarized_translation_events').insert({
        order_id,
        event_type: 'quote_created',
        new_status: 'quote_presented',
        meta: { 
          total: calcResult.total_minor, 
          subtotal: calcResult.subtotal_minor,
          vat: calcResult.vat_minor,
          vat_rate: calcResult.vat_rate,
          quote_id: quoteId 
        },
      });
    }

    // Update order status
    await serviceClient
      .from('notarized_translation_orders')
      .update({ status: 'quoted' })
      .eq('id', order_id);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        quote_id: quoteId,
        total_amount: calcResult.total_minor,
        subtotal_minor: calcResult.subtotal_minor,
        vat_minor: calcResult.vat_minor,
        vat_rate: calcResult.vat_rate,
        currency: calcResult.currency,
        breakdown: breakdown,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[quote-create] Error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
