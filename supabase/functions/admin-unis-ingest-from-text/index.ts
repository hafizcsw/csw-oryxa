import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1) Verify admin via original JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "No Authorization header" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: "Admins only" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2) Create Supabase clients
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Service role client for DB operations
    const srv = createClient(SUPABASE_URL, SRK);

    // User client for calling other admin functions with JWT
    const usr = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } }
    });

    const { text, evidence_mode = true } = await req.json();

    if (!text || text.length < 50) {
      return new Response(
        JSON.stringify({ ok: false, error: "TEXT_TOO_SHORT" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create job using service role
    const { data: job, error: e1 } = await srv
      .from("ingest_jobs")
      .insert({
        source_file_path: "INLINE_TEXT",
        source_file_sha256: "INLINE",
        mime_type: "text/plain",
        status: 'pending'
      })
      .select()
      .single();

    if (e1) throw new Error(`Job creation failed: ${e1.message}`);

    // Store text using service role
    const { error: e2 } = await srv
      .from("ingest_artifacts")
      .insert({
        job_id: job.id,
        kind: "text",
        content: { text }
      });

    if (e2) throw new Error(`Artifact failed: ${e2.message}`);

    await srv.from("ingest_jobs").update({ status: 'text_ready' }).eq('id', job.id);

    // Parse - call with direct fetch
    const parseResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/admin-unis-ingest-parse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({ job_id: job.id, evidence_mode })
      }
    );
    
    const parsed = await parseResponse.json();
    if (!parseResponse.ok) {
      console.error('[from-text] Parse error:', parsed);
      return new Response(
        JSON.stringify({ ok: false, step: "parse", error: parsed.message || parsed }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[from-text] Parse result:', JSON.stringify(parsed));
    
    if (!parsed || parsed.programs_count === 0) {
      throw new Error('لم يتم العثور على برامج في النص. يرجى التأكد من أن النص يحتوي على معلومات واضحة عن البرامج الدراسية.');
    }

    // Diff - call with direct fetch
    const diffResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/admin-unis-ingest-diff`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({ job_id: job.id })
      }
    );
    
    const diffRes = await diffResponse.json();
    if (!diffResponse.ok) {
      console.error('[from-text] Diff error:', diffRes);
      return new Response(
        JSON.stringify({ ok: false, step: "diff", error: diffRes.message || diffRes }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await srv.from("ingest_jobs").update({ status: 'diff_ready' }).eq('id', job.id);

    return new Response(
      JSON.stringify({
        ok: true,
        job_id: job.id,
        parsed,
        diff: diffRes?.diff
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
