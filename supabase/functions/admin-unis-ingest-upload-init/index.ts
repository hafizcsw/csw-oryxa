import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/http.ts";
import { requireAdminOrPilot } from "../_shared/auth.ts";

serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  
  try {
    await requireAdminOrPilot(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { filename, mime_type } = await req.json();
    const path = `uni/${crypto.randomUUID()}-${filename}`;
    
    const { data: signed, error } = await supabase.storage
      .from("ingest")
      .createSignedUploadUrl(path);
      
    if (error) throw error;

    // Create job entry
    const { data: jobRow, error: e2 } = await supabase
      .from("ingest_jobs")
      .insert({
        source_file_path: path,
        source_file_sha256: "PENDING",
        mime_type
      })
      .select("id")
      .single();
      
    if (e2) throw e2;

    return new Response(
      JSON.stringify({
        ok: true,
        path,
        upload_url: signed.signedUrl,
        token: signed.token,
        job_id: jobRow.id
      }),
      { headers: { ...corsHeaders, "content-type": "application/json" }}
    );
  } catch (error) {
    console.error('Error in upload-init:', error);
    const msg = String((error as Error).message || error);
    const code = msg === "FORBIDDEN" ? 403 : (msg === "NO_AUTH" || msg === "INVALID_USER") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status: code, headers: { ...corsHeaders, "content-type": "application/json" }}
    );
  }
});
