import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Returns a signed URL for the ORIGINAL uploaded document in notarized_originals.
 * Ownership is verified via order.customer_id.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Support both GET (query param) and POST (body)
    let job_id: string | null = null;
    if (req.method === 'POST') {
      const body = await req.json();
      job_id = body.job_id;
    } else {
      const url = new URL(req.url);
      job_id = url.searchParams.get('job_id');
    }

    if (!job_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'job_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: job, error: jobError } = await supabase
      .from('notarized_translation_jobs')
      .select(`
        id,
        original_path,
        original_meta,
        order_id,
        notarized_translation_orders!inner(customer_id)
      `)
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verify ownership (handle both array/object)
    const orderData = (job as any).notarized_translation_orders;
    const order = Array.isArray(orderData) ? orderData[0] : orderData;
    if (!order || order.customer_id !== user.id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const originalPath = (job as any).original_path as string | null;
    if (!originalPath) {
      return new Response(
        JSON.stringify({ ok: false, error: 'File not available yet' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: signedData, error: signError } = await serviceClient.storage
      .from('notarized_originals')
      .createSignedUrl(originalPath, 3600);

    if (signError) {
      console.error('Signed URL error:', signError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to generate URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        signed_url: signedData.signedUrl,
        expires_in: 3600,
        content_type: (job as any).original_meta?.type ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
