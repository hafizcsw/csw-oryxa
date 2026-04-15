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
    const g = await requireAdmin(req);
    if (!g.ok) {
      return new Response(JSON.stringify({ ok: false, error: g.error }), {
        status: g.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if backlinks import is enabled
    const { data: flagData } = await g.srv
      .from("feature_settings")
      .select("value")
      .eq("key", "backlinks_auto_import_enabled")
      .single();
    
    if (flagData?.value === "false") {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "Backlinks import is disabled" 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { rows = [] } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'No rows provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Insert in chunks to avoid overwhelming the database
    const chunkSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error, count } = await g.srv.from('seo_backlinks').insert(chunk, { count: 'exact' });
      if (error) throw error;
      inserted += (count || 0);
    }

    // Log event with telemetry
    await g.srv.from('events').insert({
      name: 'backlinks_imported',
      properties: { 
        inserted,
        reason: req.headers.get("x-cron-reason") || "manual"
      }
    });

    return new Response(
      JSON.stringify({ ok: true, inserted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error('[backlinks-import] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
