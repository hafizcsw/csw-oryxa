import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "npm:pdfjs-dist@3.11.174/legacy/build/pdf.mjs";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function extractPdfText(buffer: Uint8Array): Promise<string> {
  const loadingTask = getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  let text = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str).join(' ') + '\n';
  }
  
  return text;
}

async function extractDocxText(buffer: Uint8Array): Promise<string> {
  // Simplified DOCX extraction - في الإنتاج استخدم JSZip + XML parser
  const decoder = new TextDecoder();
  const text = decoder.decode(buffer);
  // Extract text between XML tags (simplified)
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const buffer = new Uint8Array(await fileData.arrayBuffer());
    
    let text = '';
    if (job.mime_type.includes('pdf')) {
      text = await extractPdfText(buffer);
    } else if (job.mime_type.includes('word') || job.mime_type.includes('document')) {
      text = await extractDocxText(buffer);
    } else {
      throw new Error('Unsupported file type');
    }

    // Validate extracted text
    if (text.length < 100) {
      throw new Error('NO_TEXT_EXTRACTED: File contains insufficient text');
    }

    // Save extracted text
    await supabase.from('ingest_artifacts').insert({
      job_id,
      kind: 'text',
      content: { text }
    });

    // Update job status
    await supabase.from('ingest_jobs').update({
      status: 'text_extracted'
    }).eq('id', job_id);

    // Log telemetry event
    await supabase.rpc('log_unis_event', {
      p_event_type: 'ingest_text_extracted',
      p_user_id: null,
      p_job_id: job_id,
      p_context: { chars: text.length }
    });

    return new Response(
      JSON.stringify({ ok: true, chars: text.length }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in extract-text:', error);
    const msg = String((error as Error).message || error);
    const code = msg === "FORBIDDEN" ? 403 : (msg === "NO_AUTH" || msg === "INVALID_USER") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } }
    );
  }
});
