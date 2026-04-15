import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocAttachPayload {
  application_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  doc_type: string;
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

    const payload: DocAttachPayload = await req.json();
    console.log('[apply-doc-attach] Attaching:', { 
      application_id: payload.application_id,
      doc_type: payload.doc_type,
      size: payload.file_size
    });

    if (!payload.application_id || !payload.storage_path || !payload.original_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size (max 10MB)
    if (payload.file_size && payload.file_size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 10MB limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate doc_type
    const allowedDocTypes = ['passport', 'transcript', 'ielts', 'cv', 'other'];
    if (payload.doc_type && !allowedDocTypes.includes(payload.doc_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid doc_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert document metadata
    const { data: doc, error: docError } = await supabase
      .from('application_documents')
      .insert({
        application_id: payload.application_id,
        doc_type: payload.doc_type || 'other',
        file_path: payload.storage_path,
        original_name: payload.original_name,
        mime_type: payload.mime_type,
        file_size: payload.file_size,
        status: 'uploaded'
      })
      .select()
      .single();

    if (docError) {
      console.error('[apply-doc-attach] Insert error:', docError);
      throw docError;
    }

    // Optional: Queue integration event
    await supabase
      .from('integration_events')
      .insert({
        event_name: 'application.document_uploaded',
        target: 'crm',
        payload: {
          application_id: payload.application_id,
          document_id: doc.id,
          doc_type: payload.doc_type,
          file_size: payload.file_size
        },
        idempotency_key: `doc:${doc.id}`,
        status: 'queued'
      });

    console.log('[apply-doc-attach] Document attached:', doc.id);

    return new Response(
      JSON.stringify({ ok: true, document_id: doc.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[apply-doc-attach] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
