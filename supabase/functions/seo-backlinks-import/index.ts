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

    const { backlinks } = await req.json();
    
    if (!Array.isArray(backlinks) || backlinks.length === 0) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'No backlinks provided' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let inserted = 0;
    let updated = 0;

    for (const bl of backlinks) {
      const { source_url, target_url, anchor, rel, domain, domain_rating, first_seen, last_seen } = bl;
      
      if (!source_url || !target_url) continue;

      // Check if exists
      const { data: existing } = await g.srv
        .from('seo_backlinks')
        .select('id')
        .eq('source_url', source_url)
        .eq('target_url', target_url)
        .single();

      if (existing) {
        await g.srv
          .from('seo_backlinks')
          .update({
            anchor,
            rel,
            domain,
            domain_rating,
            last_seen: last_seen || new Date().toISOString().split('T')[0]
          })
          .eq('id', existing.id);
        updated++;
      } else {
        await g.srv
          .from('seo_backlinks')
          .insert({
            source_url,
            target_url,
            anchor,
            rel,
            domain,
            domain_rating,
            first_seen: first_seen || new Date().toISOString().split('T')[0],
            last_seen: last_seen || new Date().toISOString().split('T')[0],
            source: 'csv'
          });
        inserted++;
      }
    }

    // Log telemetry
    await g.srv.from('events').insert({
      name: 'seo_backlinks_imported',
      properties: { inserted, updated, total: backlinks.length }
    });

    return new Response(JSON.stringify({ 
      ok: true, 
      inserted, 
      updated 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("[seo-backlinks-import] Error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
