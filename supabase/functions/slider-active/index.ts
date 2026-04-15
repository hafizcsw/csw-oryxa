import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const url = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => null) : null;
    const locale = (url.searchParams.get('locale') || body?.locale || 'ar') as 'ar' | 'en';

    // Query the view for active slides
    const { data, error } = await supabase
      .from('vw_slider_active')
      .select('*')
      .eq('locale', locale)
      .limit(10);

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, items: data || [] }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 min cache
      }
    });
  } catch (e: any) {
    console.error("[slider-active] Error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
