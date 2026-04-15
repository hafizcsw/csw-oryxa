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
    const job_id = url.searchParams.get('job_id');
    const type = url.searchParams.get('type'); // draft_pdf, draft_docx, scan_pdf

    if (!job_id || !type) {
      return new Response(
        JSON.stringify({ error: 'job_id and type required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validTypes = ['draft_pdf', 'draft_docx', 'scan_pdf'];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be: draft_pdf, draft_docx, or scan_pdf' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get job and verify ownership through order
    const { data: job, error: jobError } = await supabase
      .from('notarized_translation_jobs')
      .select(`
        id,
        draft_pdf_path,
        draft_docx_path,
        scan_pdf_path,
        order_id,
        notarized_translation_orders!inner(customer_id)
      `)
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership - handle both array and object responses
    const orderData = job.notarized_translation_orders;
    const order = Array.isArray(orderData) ? orderData[0] : orderData;
    if (!order || order.customer_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get file path
    let filePath: string | null = null;
    let bucket = '';
    
    switch (type) {
      case 'draft_pdf':
        filePath = job.draft_pdf_path;
        bucket = 'notarized_drafts';
        break;
      case 'draft_docx':
        filePath = job.draft_docx_path;
        bucket = 'notarized_drafts';
        break;
      case 'scan_pdf':
        filePath = job.scan_pdf_path;
        bucket = 'notarized_scans';
        break;
    }

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: 'File not available yet' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create signed download URL
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: signedData, error: signError } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (signError) {
      console.error('Signed URL error:', signError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate download URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log download event
    const serviceClientForEvents = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    await serviceClientForEvents
      .from('notarized_translation_events')
      .insert({
        job_id,
        order_id: job.order_id,
        event_type: 'downloaded',
        actor_id: user.id,
        actor_type: 'customer',
        meta: { type, file_path: filePath }
      });

    return new Response(
      JSON.stringify({ 
        ok: true,
        download_url: signedData.signedUrl,
        expires_in: 3600
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
