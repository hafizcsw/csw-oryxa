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

    const body = await req.json();
    const { slug, seo_title, seo_description, seo_h1, seo_canonical_url, map_embed_url, image_url, display_order } = body;

    if (!slug) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing slug' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const updates: any = {};
    if (seo_title !== undefined) updates.seo_title = seo_title;
    if (seo_description !== undefined) updates.seo_description = seo_description;
    if (seo_h1 !== undefined) updates.seo_h1 = seo_h1;
    if (seo_canonical_url !== undefined) updates.seo_canonical_url = seo_canonical_url;
    if (map_embed_url !== undefined) updates.map_embed_url = map_embed_url;
    if (image_url !== undefined) updates.image_url = image_url;
    if (display_order !== undefined) updates.display_order = display_order;

    const { data, error } = await g.srv
      .from('countries')
      .update(updates)
      .eq('slug', slug)
      .select()
      .single();

    if (error) throw error;

    // Telemetry
    await g.srv.from('analytics_events').insert({
      event_name: 'country_seo_updated',
      meta: { slug, fields: Object.keys(updates) }
    });

    return new Response(
      JSON.stringify({ ok: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error('[admin-country-seo-set] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
