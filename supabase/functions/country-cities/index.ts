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

    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const limit = parseInt(url.searchParams.get('limit') || '8');

    if (!slug) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing slug parameter' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get country ID
    const { data: country, error: countryError } = await supabase
      .from('countries')
      .select('id')
      .eq('slug', slug)
      .single();

    if (countryError || !country) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Country not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Get top cities by counting universities in each city
    const { data, error } = await supabase
      .from('universities')
      .select('city, country_id')
      .eq('country_id', country.id);

    if (error) throw error;

    // Count universities per city
    const cityMap = new Map<string, number>();
    data?.forEach((uni: any) => {
      if (uni.city) {
        cityMap.set(uni.city, (cityMap.get(uni.city) || 0) + 1);
      }
    });

    // Sort by count and format
    const cities = Array.from(cityMap.entries())
      .map(([name, count]) => ({ name, university_count: count }))
      .sort((a, b) => b.university_count - a.university_count)
      .slice(0, limit);

    return new Response(
      JSON.stringify({ ok: true, items: cities }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600'
        },
        status: 200
      }
    );
  } catch (e: any) {
    console.error('[country-cities] Error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
