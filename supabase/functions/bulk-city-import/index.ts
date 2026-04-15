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

    const { lines } = await req.json() as { lines: string };

    // Parse markdown table lines: |num|name|country|city|...|
    const rows = lines.split('\n')
      .filter(l => l.startsWith('|') && !l.startsWith('|-') && !l.includes('الجامعة'))
      .map(l => {
        const cols = l.split('|').map(c => c.trim()).filter(Boolean);
        if (cols.length >= 4) {
          // Clean markdown escapes
          const name = cols[1].replace(/\\\\/g, '').replace(/\\([&_])/g, '$1').trim();
          const city = cols[3].replace(/\\\\/g, '').replace(/\\([&_])/g, '$1').trim();
          return { name, city };
        }
        return null;
      })
      .filter((r): r is { name: string; city: string } => r !== null && r.name !== '' && r.city !== '');

    console.log(`[bulk-city-import] Parsed ${rows.length} records`);

    if (rows.length === 0) {
      return json({ ok: false, error: 'No records parsed' }, 400);
    }

    // Process in batches of 100
    let updated = 0;
    let notFound = 0;
    let alreadyHasCity = 0;
    let errors = 0;
    const BATCH = 100;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const names = batch.map(r => r.name);
      const cities = batch.map(r => r.city);

      const { data, error } = await supabase.rpc('admin_bulk_update_cities', {
        p_names: names,
        p_cities: cities,
      });

      if (error) {
        console.error(`[bulk-city-import] RPC error at batch ${i}:`, error.message);
        // Fallback: individual updates
        for (const record of batch) {
          try {
            const { data: matches } = await supabase
              .from('universities')
              .select('id, city')
              .ilike('name', record.name)
              .limit(1);

            if (!matches || matches.length === 0) { notFound++; continue; }
            if (matches[0].city && matches[0].city.trim() !== '') { alreadyHasCity++; continue; }

            const { error: updateErr } = await supabase
              .from('universities')
              .update({ city: record.city })
              .eq('id', matches[0].id);

            if (updateErr) errors++;
            else updated++;
          } catch { errors++; }
        }
      } else if (data) {
        updated += (data as any).updated || 0;
        notFound += (data as any).not_found || 0;
        alreadyHasCity += (data as any).already_has_city || 0;
      }

      if (i % 500 === 0) {
        console.log(`[bulk-city-import] Progress: ${i}/${rows.length}`);
      }
    }

    console.log(`[bulk-city-import] Done — updated=${updated} notFound=${notFound} alreadyHasCity=${alreadyHasCity} errors=${errors}`);

    return json({
      ok: true,
      total_parsed: rows.length,
      updated,
      not_found: notFound,
      already_has_city: alreadyHasCity,
      errors,
    });
  } catch (e: any) {
    console.error('[bulk-city-import] Fatal:', e);
    return json({ ok: false, error: String(e) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
