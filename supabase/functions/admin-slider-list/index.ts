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

    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => null) : null;
    const locale = (url.searchParams.get('locale') || body?.locale || 'ar') as 'ar' | 'en';

    const { data, error } = await g.srv
      .from('slider_universities')
      .select(`
        id,
        university_id,
        image_url,
        alt_text,
        locale,
        weight,
        start_at,
        end_at,
        published,
        created_at,
        updated_at,
        universities!inner(id, name, logo_url)
      `)
      .eq('locale', locale)
      .order('weight', { ascending: true });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("[admin-slider-list] Error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
