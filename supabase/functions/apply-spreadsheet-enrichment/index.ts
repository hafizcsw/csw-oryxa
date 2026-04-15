import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Reads from spreadsheet_enrichment_staging table and applies updates to universities.
 * Updates: website (if missing), city (from map_location), country_code (if missing).
 */

function extractCityFromMapLocation(mapLocation: string): string | null {
  const parts = mapLocation.split(',').map(p => p.trim());
  // Format: "Uni Name, City, Region, Country" → take index 1
  if (parts.length >= 3) return parts[1];
  if (parts.length === 2) return parts[0];
  return null;
}

const GARBAGE_CITY_PATTERNS = [
  /^(NaN|Beijing|New Delhi|New York|Berlin|Moscow|Manila|Lisbon|Tokyo|Toronto|Tunis|Riyadh|Paris)$/i,
  /chinese medicine/i, /police$/i, /^fine arts$/i, /^philosophy$/i, /^jewish studies$/i,
  /jiaotong$/i, /radio & tv/i, /^saarland$/i, /vocational$/i, /college$/i,
  /agricultural$/i, /^european$/i, /^lusophone$/i, /^atlantic$/i,
  /technology and management/i, /science and commerce/i, /^culture and/i,
];

function isBadCity(city: string | null): boolean {
  if (!city || city.trim() === '') return true;
  return GARBAGE_CITY_PATTERNS.some(p => p.test(city.trim()));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run ?? false;
    const limit = body.limit ?? 1000;

    // Read unapplied records from staging
    const { data: records, error: readErr } = await supabase
      .from('spreadsheet_enrichment_staging')
      .select('*')
      .eq('applied', false)
      .eq('resolution_status', 'WEBSITE_FOUND')
      .order('id')
      .limit(limit);

    if (readErr) throw readErr;
    if (!records?.length) {
      return json({ ok: true, message: 'No unapplied records found', total: 0 });
    }

    console.log(`[spreadsheet-enrichment] Processing ${records.length} staging records, dry_run=${dryRun}`);

    let matched = 0, notFound = 0, updated = 0, noChanges = 0, errors = 0;
    const results: any[] = [];

    for (const record of records) {
      if (!record.name_en?.trim()) continue;

      const { data: uni } = await supabase
        .from('universities')
        .select('id, name, website, city, country_code')
        .ilike('name', record.name_en.trim())
        .maybeSingle();

      if (!uni) {
        notFound++;
        if (results.length < 300) results.push({ name: record.name_en, status: 'not_found' });
        continue;
      }

      matched++;
      const updates: Record<string, any> = {};

      // Website
      if (record.official_website && (!uni.website || uni.website === '')) {
        updates.website = record.official_website;
      }

      // Country code
      if (record.country_code && (!uni.country_code || uni.country_code === '')) {
        updates.country_code = record.country_code;
      }

      // City - prefer map_location extraction, fallback to spreadsheet city
      const currentCity = uni.city || '';
      if (isBadCity(currentCity)) {
        let newCity: string | null = null;
        if (record.map_location) {
          newCity = extractCityFromMapLocation(record.map_location);
        }
        if (!newCity && record.city && !isBadCity(record.city)) {
          newCity = record.city;
        }
        if (newCity) {
          updates.city = newCity;
        }
      }

      if (Object.keys(updates).length === 0) {
        noChanges++;
        if (results.length < 300) results.push({ name: record.name_en, id: uni.id, status: 'no_changes' });
        // Mark as applied even if no changes needed
        if (!dryRun) {
          await supabase.from('spreadsheet_enrichment_staging').update({ applied: true }).eq('id', record.id);
        }
        continue;
      }

      if (dryRun) {
        updated++;
        if (results.length < 300) results.push({
          name: record.name_en, id: uni.id, status: 'would_update',
          updates, current: { website: uni.website, city: uni.city, country_code: uni.country_code }
        });
        continue;
      }

      let { error: updateError } = await supabase
        .from('universities')
        .update(updates)
        .eq('id', uni.id);

      // Handle duplicate website constraint - retry without website
      if (updateError?.message?.includes('uq_universities_website_host') && updates.website) {
        delete updates.website;
        if (Object.keys(updates).length > 0) {
          const retry = await supabase.from('universities').update(updates).eq('id', uni.id);
          updateError = retry.error;
        } else {
          updateError = null; // no updates left, treat as no_changes
          noChanges++;
          await supabase.from('spreadsheet_enrichment_staging').update({ applied: true }).eq('id', record.id);
          continue;
        }
      }

      if (updateError) {
        errors++;
        if (results.length < 300) results.push({ name: record.name_en, id: uni.id, status: 'error', error: updateError.message });
      } else {
        updated++;
        await supabase.from('spreadsheet_enrichment_staging').update({ applied: true }).eq('id', record.id);
        if (results.length < 300) results.push({ name: record.name_en, id: uni.id, status: 'updated', updates });
      }
    }

    console.log(`[spreadsheet-enrichment] Done — matched=${matched} updated=${updated} notFound=${notFound} noChanges=${noChanges} errors=${errors}`);

    return json({
      ok: true, dry_run: dryRun,
      summary: { total: records.length, matched, updated, notFound, noChanges, errors },
      results,
    });
  } catch (error: any) {
    console.error('[spreadsheet-enrichment] Error:', error);
    return json({ ok: false, error: error?.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
