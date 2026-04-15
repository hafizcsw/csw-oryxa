import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const repairs: Record<string, number> = {
      bad_ranks_fixed: 0,
      nan_cities_fixed: 0,
    };

    // ========== FIX 1: world_rank = year (1900-2100) ==========
    const { data: badRanks, error: rankFetchError } = await supabase
      .from('institution_rankings')
      .select('id')
      .eq('ranking_system', 'uniranks')
      .gte('world_rank', 1900)
      .lte('world_rank', 2100);

    if (!rankFetchError && badRanks && badRanks.length > 0) {
      const { error: rankUpdateError } = await supabase
        .from('institution_rankings')
        .update({ world_rank: null })
        .in('id', badRanks.map(r => r.id));

      if (!rankUpdateError) {
        repairs.bad_ranks_fixed = badRanks.length;
        console.log(`[uniranks-data-repair] Fixed ${badRanks.length} bad world_rank values`);
      } else {
        console.error(`[uniranks-data-repair] Rank update failed:`, rankUpdateError);
      }
    }

    // ========== FIX 2: city = NaN/N/A ==========
    const { data: nanCities, error: cityFetchError } = await supabase
      .from('universities')
      .select('id')
      .or('city.eq.nan,city.eq.NaN,city.eq.N/A,city.eq.n/a,city.eq.undefined,city.eq.null');

    if (!cityFetchError && nanCities && nanCities.length > 0) {
      const { error: cityUpdateError } = await supabase
        .from('universities')
        .update({ city: null })
        .in('id', nanCities.map(u => u.id));

      if (!cityUpdateError) {
        repairs.nan_cities_fixed = nanCities.length;
        console.log(`[uniranks-data-repair] Fixed ${nanCities.length} NaN city values`);
      } else {
        console.error(`[uniranks-data-repair] City update failed:`, cityUpdateError);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        repairs,
        message: `Repaired ${repairs.bad_ranks_fixed} bad ranks and ${repairs.nan_cities_fixed} NaN cities`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[uniranks-data-repair] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
