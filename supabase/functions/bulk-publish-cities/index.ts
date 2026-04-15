import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminOrServiceRole } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const g = await requireAdminOrServiceRole(req);
    if (!g.ok) {
      return new Response(JSON.stringify({ ok: false, error: g.error }), {
        status: g.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { rows } = await req.json() as { rows: { name: string; city: string }[] };
    if (!rows?.length) {
      return new Response(JSON.stringify({ ok: false, error: 'rows required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let updated = 0, skipped = 0, notFound = 0;

    // Process in chunks of 20
    for (let i = 0; i < rows.length; i += 20) {
      const chunk = rows.slice(i, i + 20);
      
      for (const row of chunk) {
        // Find university by name_en
        const { data: unis } = await g.srv
          .from('universities')
          .select('id, city')
          .eq('name_en', row.name)
          .limit(1);

        if (!unis?.length) {
          notFound++;
          continue;
        }

        const uni = unis[0];
        if (uni.city && uni.city.trim() !== '') {
          skipped++;
          continue;
        }

        const { error } = await g.srv
          .from('universities')
          .update({ city: row.city })
          .eq('id', uni.id);

        if (error) {
          console.error(`Failed ${row.name}: ${error.message}`);
        } else {
          updated++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, updated, skipped, notFound, total: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
