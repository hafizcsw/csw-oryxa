import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Support both GET (query params) and POST (body)
    let slug: string | null = null;
    let limit = 6;

    if (req.method === "GET") {
      const url = new URL(req.url);
      slug = url.searchParams.get('slug');
      limit = parseInt(url.searchParams.get('limit') || '6');
    } else if (req.method === "POST") {
      const body = await req.json();
      slug = body.slug;
      limit = body.limit || 6;
    }

    if (!slug) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing slug parameter' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get country first
    const { data: country } = await supabase
      .from('countries')
      .select('id, name_en')
      .eq('slug', slug)
      .single();

    if (!country) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Country not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Get top universities
    const { data: universities, error } = await supabase
      .from('universities')
      .select('id, name, city, logo_url, ranking, annual_fees')
      .eq('country_id', country.id)
      .eq('is_active', true)
      .order('ranking', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, data: universities || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error('[get-country-universities] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
