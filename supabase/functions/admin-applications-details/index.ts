import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/auth.ts';
import { verifyAdminJWT } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const jwt = await verifyAdminJWT(req.headers.get('authorization'));
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { application_id } = await req.json();
    if (!application_id) {
      return new Response(
        JSON.stringify({ error: 'application_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', application_id)
      .single();

    if (appError) {
      console.error('[admin-applications-details] App error:', appError);
      return new Response(
        JSON.stringify({ error: appError.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: programs } = await supabase
      .from('application_programs')
      .select('program_id, programs(title, universities(name))')
      .eq('application_id', application_id);

    const { data: documents } = await supabase
      .from('application_documents')
      .select('id, doc_type, file_path, original_name, mime_type, file_size, status, created_at')
      .eq('application_id', application_id);

    return new Response(
      JSON.stringify({ 
        app, 
        programs: programs ?? [], 
        documents: documents ?? [] 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[admin-applications-details] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
