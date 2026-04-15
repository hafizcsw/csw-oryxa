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

    // Support both GET (query param) and POST (body)
    let order_id: string | null = null;
    
    if (req.method === 'POST') {
      const body = await req.json();
      order_id = body.order_id;
    } else {
      const url = new URL(req.url);
      order_id = url.searchParams.get('order_id');
    }

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get order with jobs
    const { data: order, error: orderError } = await supabase
      .from('notarized_translation_orders')
      .select(`
        id,
        status,
        delivery_mode,
        doc_slots,
        created_at,
        updated_at
      `)
      .eq('id', order_id)
      .eq('customer_id', user.id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('notarized_translation_jobs')
      .select(`
        id,
        doc_slot,
        status,
        original_path,
        original_meta,
        quality_score,
        quality_flags,
        rejection_code,
        rejection_reasons,
        fix_tips,
        doc_type_guess,
        draft_pdf_path,
        draft_docx_path,
        scan_pdf_path,
        created_at,
        updated_at
      `)
      .eq('order_id', order_id)
      .order('created_at');

    if (jobsError) {
      return new Response(
        JSON.stringify({ error: jobsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recent events
    const { data: events } = await supabase
      .from('notarized_translation_events')
      .select('id, event_type, old_status, new_status, created_at, meta')
      .eq('order_id', order_id)
      .order('created_at', { ascending: false })
      .limit(20);

    return new Response(
      JSON.stringify({ 
        ok: true,
        order,
        jobs: jobs || [],
        events: events || []
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
