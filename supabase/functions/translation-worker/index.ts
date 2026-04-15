import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const srv = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const AI_TRANSLATION_ENABLED = Deno.env.get('ENABLE_AI_TRANSLATION') !== '0';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')?.trim() || null;

interface TranslationJob {
  id: string;
  entity_type: 'program' | 'university';
  entity_id: string;
  target_lang: string;
  source_lang: string;
  source_text: string;
  field_name: 'name' | 'description';
  attempts: number;
}

async function translateText(text: string, targetLang: string, sourceLang: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}. 
Output ONLY the translated text, nothing else. Preserve formatting and meaning. 
For academic/university context, use appropriate formal terminology.`
        },
        {
          role: "user",
          content: text
        }
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Translation API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const translated = data.choices?.[0]?.message?.content?.trim();
  
  if (!translated) {
    throw new Error("Empty translation response");
  }

  return translated;
}

async function processJob(job: TranslationJob): Promise<{ ok: boolean; error?: string }> {
  try {
    // Translate
    const translated = await translateText(job.source_text, job.target_lang, job.source_lang);

    // Write to i18n table using COMPOSITE PRIMARY KEY (not id)
    const tableName = job.entity_type === 'program' ? 'program_i18n' : 'university_i18n';
    const idColumn = job.entity_type === 'program' ? 'program_id' : 'university_id';

    // First try UPDATE with composite PK
    const updateData: Record<string, unknown> = {
      [job.field_name]: translated,
      source: 'machine_on_demand',
      quality_score: 30,
      updated_at: new Date().toISOString(),
    };
    
    const { data: updateResult, error: updateError } = await srv
      .from(tableName)
      .update(updateData)
      .eq(idColumn, job.entity_id)
      .eq('lang_code', job.target_lang)
      .select('*');

    // If no rows updated, INSERT new row
    if (!updateError && (!updateResult || updateResult.length === 0)) {
      const insertData: Record<string, unknown> = {
        [idColumn]: job.entity_id,
        lang_code: job.target_lang,
        [job.field_name]: translated,
        source: 'machine_on_demand',
        quality_score: 30,
      };
      
      const { error: insertError } = await srv
        .from(tableName)
        .insert(insertData);

      if (insertError) {
        throw new Error(`Insert failed: ${insertError.message}`);
      }
    } else if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`);
    }

    // Mark job as done
    await srv.from('translation_jobs').update({
      status: 'done',
      processed_at: new Date().toISOString(),
    }).eq('id', job.id);

    console.log(`[translation-worker] ✅ Translated ${job.entity_type}/${job.entity_id} ${job.field_name} → ${job.target_lang}`);
    return { ok: true };

  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(`[translation-worker] ❌ Job ${job.id} failed:`, errorMessage);

    const newStatus = job.attempts + 1 >= MAX_RETRIES ? 'error' : 'pending';
    await srv.from('translation_jobs').update({
      status: newStatus,
      last_error: errorMessage.slice(0, 500),
    }).eq('id', job.id);

    return { ok: false, error: errorMessage };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Security: Two auth methods supported
  // 1. Worker secret header (for cron/external calls)
  // 2. Admin JWT (for manual testing via UI)
  const WORKER_SECRET = Deno.env.get("TRANSLATION_WORKER_SECRET");
  const providedSecret = req.headers.get("x-worker-secret");
  
  let isAuthorized = false;
  
  // Method 1: Worker secret
  if (WORKER_SECRET && providedSecret === WORKER_SECRET) {
    isAuthorized = true;
    console.log('[translation-worker] ✅ Auth via worker secret');
  }
  
  // Method 2: Admin JWT (only if ALLOW_ADMIN_WORKER_TEST=1)
  if (!isAuthorized && Deno.env.get("ALLOW_ADMIN_WORKER_TEST") === "1") {
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const anon = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user }, error } = await anon.auth.getUser();
        if (!error && user) {
          // Check admin status via RPC
          const srvClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          const { data: isAdmin } = await srvClient.rpc("is_admin", { _user_id: user.id });
          if (isAdmin) {
            isAuthorized = true;
            console.log(`[translation-worker] ✅ Auth via admin JWT: ${user.id}`);
          }
        }
      } catch (e) {
        console.warn('[translation-worker] JWT check failed:', e);
      }
    }
  }
  
  if (!isAuthorized) {
    console.error('[translation-worker] ❌ Unauthorized: Invalid or missing credentials');
    return new Response(
      JSON.stringify({ ok: false, error: 'unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!AI_TRANSLATION_ENABLED) {
    console.log('[translation-worker] AI translation disabled by ENABLE_AI_TRANSLATION=0');
    return new Response(
      JSON.stringify({ ok: true, processed: 0, skipped: true, reason: 'ai_translation_disabled' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!OPENAI_API_KEY) {
    console.warn('[translation-worker] Missing OPENAI_API_KEY; skipping batch without claiming jobs');
    return new Response(
      JSON.stringify({ ok: true, processed: 0, skipped: true, reason: 'missing_openai_api_key' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('[translation-worker] Starting batch processing...');

    // Atomic claim jobs using RPC (FOR UPDATE SKIP LOCKED)
    const { data: jobs, error: claimError } = await srv
      .rpc('rpc_claim_translation_jobs', { p_limit: BATCH_SIZE });

    if (claimError) {
      console.error('[translation-worker] Claim error:', claimError);
      throw claimError;
    }

    if (!jobs || jobs.length === 0) {
      console.log('[translation-worker] No pending jobs');
      return new Response(
        JSON.stringify({ ok: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[translation-worker] Processing ${jobs.length} jobs...`);

    let successCount = 0;
    let errorCount = 0;

    // Process jobs sequentially to respect rate limits
    for (const job of jobs as TranslationJob[]) {
      const result = await processJob(job);
      if (result.ok) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Small delay between jobs to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[translation-worker] Done: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        processed: jobs.length,
        success: successCount,
        errors: errorCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[translation-worker] Fatal error:', message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
