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

    const url = new URL(req.url);
    let order_id = url.searchParams.get('order_id');

    // Support POST body as well (so web clients can call via functions.invoke)
    if (!order_id && req.method !== 'GET') {
      try {
        const body = await req.json().catch(() => null);
        order_id = body?.order_id || body?.orderId || null;
      } catch {
        // ignore
      }
    }

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    const { data: order } = await supabase
      .from('notarized_translation_orders')
      .select('id, customer_id')
      .eq('id', order_id)
      .eq('customer_id', user.id)
      .single();

    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get quote using service role
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await serviceClient.rpc('rpc_translation_quote_get', {
      p_order_id: order_id
    });

    if (error) {
      console.error('RPC error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize "not found" into an HTTP error so clients don't treat it as success.
    if (!data || (typeof data === 'object' && (data as any)?.ok === false)) {
      const msg = (data as any)?.error || 'No quote found';
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform data to include enhanced line items with detailed breakdown
    if (data && data.breakdown && data.breakdown.line_items) {
      // Fetch pricing rules to enrich line items
      const { data: pricingRules } = await serviceClient
        .from('notarized_pricing_rules')
        .select('doc_slot, base_fee, extra_page_fee, complexity_surcharge')
        .eq('is_active', true);

      const rulesMap = new Map(
        (pricingRules || []).map((r: any) => [r.doc_slot, r])
      );

      // Enrich each line item with detailed breakdown
      data.breakdown.line_items = data.breakdown.line_items.map((li: any) => {
        const rule = rulesMap.get(li.doc_slot);
        const pageCount = li.page_count || 1;
        const extraPages = Math.max(pageCount - 1, 0);
        
        if (rule) {
          const baseFee = li.base_fee ?? rule.base_fee ?? 0;
          const extraPageFee = li.extra_page_fee ?? rule.extra_page_fee ?? 0;
          const extraPagesFee = li.extra_pages_fee ?? (extraPages * extraPageFee);
          const complexitySurcharge = li.complexity_surcharge ?? rule.complexity_surcharge ?? 0;
          const lineTotal = li.line_total ?? (baseFee + extraPagesFee + complexitySurcharge);
          
          return {
            ...li,
            base_fee: baseFee,
            extra_page_fee: extraPageFee,
            extra_pages: extraPages,
            extra_pages_fee: extraPagesFee,
            complexity_surcharge: complexitySurcharge,
            line_total: lineTotal,
          };
        }
        
        // Fallback: no rule found, return as-is with defaults
        return {
          ...li,
          base_fee: li.base_fee ?? li.line_total ?? 0,
          extra_page_fee: li.extra_page_fee ?? 0,
          extra_pages: extraPages,
          extra_pages_fee: li.extra_pages_fee ?? 0,
          complexity_surcharge: li.complexity_surcharge ?? 0,
          line_total: li.line_total ?? 0,
        };
      });
    }

    return new Response(
      JSON.stringify(data),
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
