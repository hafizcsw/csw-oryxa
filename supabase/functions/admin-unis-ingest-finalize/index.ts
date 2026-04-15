import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/http.ts";
import { requireAdmin } from "../_shared/auth.ts";

async function sha256(buf: Uint8Array): Promise<string> {
  // Create a proper ArrayBuffer for crypto.subtle
  const arrayBuffer = new ArrayBuffer(buf.length);
  const view = new Uint8Array(arrayBuffer);
  view.set(buf);
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  
  try {
    await requireAdmin(req);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { job_id } = await req.json();

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('ingest_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError) throw jobError;

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('ingest')
      .download(job.source_file_path);

    if (downloadError) throw downloadError;

    // Calculate SHA-256
    const buffer = new Uint8Array(await fileData.arrayBuffer());
    const digest = await sha256(buffer);

    // Check for duplicates
    const { data: duplicate } = await supabase
      .from('ingest_jobs')
      .select('id')
      .eq('source_file_sha256', digest)
      .neq('id', job_id)
      .maybeSingle();

    if (duplicate) {
      await supabase.from('ingest_jobs').update({
        status: 'failed',
        error: 'DUPLICATE_FILE'
      }).eq('id', job_id);

      return new Response(
        JSON.stringify({ ok: false, duplicate_of: duplicate.id }),
        { status: 409, headers: { ...corsHeaders, 'content-type': 'application/json' } }
      );
    }

    // Update with SHA-256
    await supabase.from('ingest_jobs').update({
      source_file_sha256: digest
    }).eq('id', job_id);

    // Log telemetry event
    await supabase.rpc('log_unis_event', {
      p_event_type: 'ingest_finalized',
      p_user_id: null,
      p_job_id: job_id,
      p_context: { sha256: digest, size_bytes: buffer.length }
    });

    return new Response(
      JSON.stringify({ ok: true, sha256: digest }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in finalize:', error);
    const msg = String((error as Error).message || error);
    const code = msg === "FORBIDDEN" ? 403 : (msg === "NO_AUTH" || msg === "INVALID_USER") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }
});
