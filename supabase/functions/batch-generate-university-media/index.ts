import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";
import { handleCorsPreflight, getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { university_ids, media_type = 'both', quality = 'high' } = await req.json();
    
    if (!university_ids || !Array.isArray(university_ids) || university_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'university_ids array required' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results = {
      total: university_ids.length,
      processed: 0,
      successful: 0,
      failed: 0,
      details: [] as any[]
    };

    console.log('[batch-generate] Starting batch generation for', university_ids.length, 'universities');

    for (const universityId of university_ids) {
      try {
        console.log('[batch-generate] Processing university:', universityId);
        
        // Call the single generation function using direct fetch
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/admin-generate-university-media`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ 
              university_id: universityId,
              media_type,
              quality 
            })
          }
        );

        const data = await response.json();
        if (!response.ok || !data?.ok) {
          console.error('[batch-generate] Failed for university:', universityId, data);
          results.failed++;
          const errMsg = (data as any)?.error instanceof Error 
            ? (data as any).error.message 
            : (data as any)?.error || 'Unknown error';
          results.details.push({
            university_id: universityId,
            status: 'failed',
            error: errMsg
          });
        } else {
          console.log('[batch-generate] Success for university:', universityId);
          results.successful++;
          results.details.push({
            university_id: universityId,
            university_name: data.university_name,
            status: 'success',
            suggestions_count: data.suggestions?.length || 0
          });
        }

        results.processed++;

        // Add delay between requests to avoid rate limits (2 seconds)
        if (results.processed < university_ids.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error('[batch-generate] Exception for university:', universityId, error);
        results.failed++;
        const errMsg = error instanceof Error ? error.message : 'Exception occurred';
        results.details.push({
          university_id: universityId,
          status: 'failed',
          error: errMsg
        });
      }
    }

    console.log('[batch-generate] Batch complete:', results);

    return new Response(JSON.stringify({
      ok: true,
      ...results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('[batch-generate] Fatal error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ 
      error: message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, 
      status: 500 
    });
  }
});
