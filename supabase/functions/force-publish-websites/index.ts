import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { offset = 0, limit = 500 } = await req.json();

    // Get enrichment rows that still need publishing
    // Join with universities to only get those without website
    const { data: rows, error: fetchErr } = await supabase.rpc('get_unpublished_websites', {
      p_job_id: '87b5eeb2-a1bd-48a7-9668-502d8f6eb7cd',
      p_limit: limit,
      p_offset: offset
    });

    // Fallback: just get all applied rows and try them
    const { data: allRows, error: allErr } = await supabase
      .from('website_enrichment_rows')
      .select('university_id, provider_homepage_url_raw')
      .eq('job_id', '87b5eeb2-a1bd-48a7-9668-502d8f6eb7cd')
      .eq('enrichment_status', 'applied')
      .not('provider_homepage_url_raw', 'is', null)
      .neq('provider_homepage_url_raw', '')
      .range(offset, offset + limit - 1);

    if (allErr) throw allErr;
    if (!allRows?.length) {
      return json({ ok: true, done: true, published: 0, skipped: 0, errors: 0 });
    }

    let published = 0, skipped = 0, errors = 0;
    const errorDetails: string[] = [];

    for (const row of allRows) {
      try {
        // First check if uni needs a website
        const { data: uni } = await supabase
          .from('universities')
          .select('id, website, website_host')
          .eq('id', row.university_id)
          .single();

        if (!uni) { skipped++; continue; }
        if (uni.website && uni.website.trim() !== '') { skipped++; continue; }

        // Extract host to check for conflicts
        let host: string | null = null;
        try {
          const u = new URL(row.provider_homepage_url_raw);
          host = u.host.replace(/^www\./, '') + '/';
        } catch { /* ignore */ }

        // If there's a host, clear conflicting entries first
        if (host) {
          // Check if another uni already has this host
          const { data: conflict } = await supabase
            .from('universities')
            .select('id')
            .eq('website_host', host)
            .neq('id', row.university_id)
            .limit(1);

          if (conflict && conflict.length > 0) {
            // Clear the conflicting host from the other university
            await supabase
              .from('universities')
              .update({ website_host: null })
              .eq('website_host', host)
              .neq('id', row.university_id);
          }
        }

        // Now update
        const { error: updErr } = await supabase
          .from('universities')
          .update({ website: row.provider_homepage_url_raw })
          .eq('id', row.university_id);

        if (updErr) {
          errors++;
          if (errorDetails.length < 5) errorDetails.push(`${row.university_id}: ${updErr.message?.slice(0, 60)}`);
        } else {
          published++;
        }
      } catch (e: any) {
        errors++;
      }
    }

    return json({ 
      ok: true, done: allRows.length < limit, 
      batch_size: allRows.length, published, skipped, errors,
      next_offset: offset + limit,
      error_samples: errorDetails
    });

  } catch (e: any) {
    console.error('Fatal:', e);
    return json({ ok: false, error: e?.message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
