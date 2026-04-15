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
    const { id, university_id, image_url, alt_text, locale, weight, start_at, end_at, published } = body;

    const payload: any = {
      university_id,
      image_url: image_url || null,
      alt_text: alt_text || null,
      locale: locale || 'ar',
      weight: weight || 0,
      start_at: start_at || null,
      end_at: end_at || null,
      published: !!published,
      last_editor: g.user.id
    };

    let result;
    if (id) {
      // Update
      result = await g.srv
        .from('slider_universities')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    } else {
      // Insert
      result = await g.srv
        .from('slider_universities')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    // Telemetry
    await g.srv.from('analytics_events').insert({
      event_name: id ? 'slider_updated' : 'slider_created',
      meta: { id: result.data.id, locale: result.data.locale, published: result.data.published }
    });

    return new Response(JSON.stringify({ ok: true, data: result.data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("[admin-slider-upsert] Error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
