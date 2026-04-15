import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadUrlPayload {
  application_id: string;
  filename: string;
  mime: string;
  file_size: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const payload: UploadUrlPayload = await req.json();
    console.log('[apply-upload-url] Request:', { 
      application_id: payload.application_id,
      filename: payload.filename,
      file_size: payload.file_size
    });

    if (!payload.application_id || !payload.filename || !payload.mime || !payload.file_size) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size (max 10MB)
    if (payload.file_size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 10MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate MIME type
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];
    if (!allowedMimes.includes(payload.mime.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Only PDF and images allowed.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify application exists
    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('id', payload.application_id)
      .single();

    if (appError || !app) {
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize filename
    const safeName = payload.filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 100);
    
    const timestamp = Date.now();
    const storagePath = `applications/${payload.application_id}/${timestamp}_${safeName}`;

    // Create signed upload URL (valid for 10 minutes)
    const { data: signedData, error: signError } = await supabase
      .storage
      .from('applications')
      .createSignedUploadUrl(storagePath);

    if (signError) {
      console.error('[apply-upload-url] Sign error:', signError);
      throw signError;
    }

    console.log('[apply-upload-url] Generated signed URL for:', storagePath);

    return new Response(
      JSON.stringify({
        upload_url: signedData.signedUrl,
        storage_path: storagePath,
        token: signedData.token
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[apply-upload-url] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
