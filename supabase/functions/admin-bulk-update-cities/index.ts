import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { records } = await req.json() as { records: { name: string; city: string }[] };

    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No records provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[bulk-update-cities] Processing ${records.length} records`);

    // Use a single SQL query with unnest for efficiency
    const names = records.map(r => r.name.trim());
    const cities = records.map(r => r.city.trim());

    // Step 1: Create temp staging and update in one shot
    const { data, error } = await supabase.rpc('admin_bulk_update_cities', {
      p_names: names,
      p_cities: cities,
    });

    if (error) {
      // Fallback to individual updates if RPC doesn't exist
      console.log('[bulk-update-cities] RPC not found, falling back to individual updates');
      
      let updated = 0;
      let notFound = 0;
      let alreadyHasCity = 0;
      let errors = 0;

      for (const record of records) {
        try {
          const name = record.name.trim();
          const city = record.city.trim();
          if (!name || !city) { errors++; continue; }

          // Try exact match first
          const { data: matches } = await supabase
            .from('universities')
            .select('id, city')
            .ilike('name', name)
            .limit(1);

          if (!matches || matches.length === 0) {
            notFound++;
            continue;
          }

          if (matches[0].city && matches[0].city.trim() !== '') {
            alreadyHasCity++;
            continue;
          }

          const { error: updateError } = await supabase
            .from('universities')
            .update({ city })
            .eq('id', matches[0].id);

          if (updateError) { errors++; } else { updated++; }
        } catch { errors++; }
      }

      return new Response(
        JSON.stringify({ ok: true, method: 'individual', updated, notFound, alreadyHasCity, errors }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, method: 'rpc', result: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[bulk-update-cities] Fatal error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
