import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GARBAGE_CITY_PATTERNS = [
  /^(NaN|Beijing|New Delhi|New York|Berlin|Moscow|Manila|Lisbon|Tokyo|Toronto|Tunis|Riyadh|Paris)$/i,
  /chinese medicine/i, /police$/i, /^fine arts$/i, /^philosophy$/i, /^jewish studies$/i,
  /jiaotong$/i, /radio & tv/i, /^saarland$/i, /vocational$/i, /college$/i,
  /agricultural$/i, /^european$/i, /^lusophone$/i, /^atlantic$/i,
  /technology and management/i, /science and commerce/i, /^culture and/i,
  /^psl paris$/i, /^international studies$/i, /^national$/i, /^united nations$/i,
];

function isBadCity(city: string | null): boolean {
  if (!city || city.trim() === '') return true;
  return GARBAGE_CITY_PATTERNS.some(p => p.test(city.trim()));
}

function extractCityFromMapLocation(mapLocation: string): string | null {
  const parts = mapLocation.split(',').map(p => p.trim());
  if (parts.length >= 3) return parts[1];
  if (parts.length === 2) return parts[0];
  return null;
}

interface Record {
  name_en: string;
  country_code?: string;
  city?: string;
  official_website?: string;
  map_location?: string;
  resolution_status?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // ══════════════════════════════════════════════════════════════════════
    // HARD FREEZE — Phase 1 Safety Repair (2026-03-18)
    // This function is FROZEN. Bulk import from spreadsheets is removed
    // from active write paths. No writes to `universities` table.
    // Freeze reason: official-site-only lane policy.
    // ══════════════════════════════════════════════════════════════════════
    console.warn("[bulk-import] FROZEN — phase1_official_site_only_freeze");
    await supabase.from("pipeline_health_events").insert({
      pipeline: "bulk_import_enrichment",
      event_type: "freeze",
      metric: "hard_freeze_block",
      value: 1,
      details_json: { frozen_at: new Date().toISOString(), reason: "phase1_official_site_only" },
    }).then(() => {}).catch(() => {});
    return json({ ok: false, frozen: true, reason: "phase1_official_site_only_freeze" });

    // === FROZEN CODE BELOW — unreachable ===
    const { records, dry_run = false } = await req.json() as { records: Record[], dry_run?: boolean };
    
    if (!records?.length) {
      return json({ ok: false, error: 'No records provided' });
    }

    // Filter to WEBSITE_FOUND only, skip noise
    const valid = records.filter(r => 
      r.resolution_status === 'WEBSITE_FOUND' && 
      r.name_en && 
      r.name_en !== 'World University Rankings'
    );

    console.log(`[bulk-import] ${valid.length} valid WEBSITE_FOUND records out of ${records.length} total`);

    // Get already-staged names to avoid duplicates
    const { data: existing } = await supabase
      .from('spreadsheet_enrichment_staging')
      .select('name_en');
    
    const existingNames = new Set((existing || []).map(e => e.name_en?.toLowerCase()));
    
    const newRecords = valid.filter(r => !existingNames.has(r.name_en.toLowerCase()));
    console.log(`[bulk-import] ${newRecords.length} new records to stage (${valid.length - newRecords.length} already exist)`);

    // Stage new records
    if (!dry_run && newRecords.length > 0) {
      const toInsert = newRecords.map(r => ({
        name_en: r.name_en,
        country_code: r.country_code || null,
        city: r.city || null,
        official_website: r.official_website || null,
        map_location: r.map_location || null,
        resolution_status: 'WEBSITE_FOUND',
        applied: false,
      }));
      
      // Insert in batches of 100
      for (let i = 0; i < toInsert.length; i += 100) {
        const batch = toInsert.slice(i, i + 100);
        const { error } = await supabase.from('spreadsheet_enrichment_staging').insert(batch);
        if (error) {
          console.error(`[bulk-import] Insert batch error at ${i}:`, error.message);
        }
      }
    }

    // Now apply enrichment to all unapplied records
    const { data: unapplied, error: readErr } = await supabase
      .from('spreadsheet_enrichment_staging')
      .select('*')
      .eq('applied', false)
      .eq('resolution_status', 'WEBSITE_FOUND')
      .order('id')
      .limit(2000);

    if (readErr) throw readErr;

    let matched = 0, notFound = 0, updated = 0, noChanges = 0, errors = 0, skippedWebsite = 0;
    const results: any[] = [];

    for (const record of (unapplied || [])) {
      if (!record.name_en?.trim()) continue;

      const { data: uni } = await supabase
        .from('universities')
        .select('id, name, website, city, country_code')
        .ilike('name', record.name_en.trim())
        .maybeSingle();

      if (!uni) {
        notFound++;
        if (results.length < 100) results.push({ name: record.name_en, status: 'not_found' });
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

      // City
      const currentCity = uni.city || '';
      if (isBadCity(currentCity)) {
        let newCity: string | null = null;
        if (record.map_location) {
          newCity = extractCityFromMapLocation(record.map_location);
        }
        if (!newCity && record.city && !isBadCity(record.city)) {
          newCity = record.city;
        }
        if (newCity && !isBadCity(newCity)) {
          updates.city = newCity;
        }
      }

      if (Object.keys(updates).length === 0) {
        noChanges++;
        if (!dry_run) {
          await supabase.from('spreadsheet_enrichment_staging').update({ applied: true }).eq('id', record.id);
        }
        continue;
      }

      if (dry_run) {
        updated++;
        if (results.length < 100) results.push({ name: record.name_en, id: uni.id, status: 'would_update', updates });
        continue;
      }

      const { error: updateError } = await supabase
        .from('universities')
        .update(updates)
        .eq('id', uni.id);

      if (updateError) {
        if (updateError.message?.includes('uq_universities_website_host')) {
          skippedWebsite++;
          // Try without website
          delete updates.website;
          if (Object.keys(updates).length > 0) {
            await supabase.from('universities').update(updates).eq('id', uni.id);
          }
          await supabase.from('spreadsheet_enrichment_staging').update({ applied: true }).eq('id', record.id);
        } else {
          errors++;
        }
      } else {
        updated++;
        await supabase.from('spreadsheet_enrichment_staging').update({ applied: true }).eq('id', record.id);
        if (results.length < 100) results.push({ name: record.name_en, id: uni.id, status: 'updated', updates });
      }
    }

    console.log(`[bulk-import] Done — staged=${newRecords.length} matched=${matched} updated=${updated} notFound=${notFound} noChanges=${noChanges} errors=${errors} skippedWebsite=${skippedWebsite}`);

    return json({
      ok: true, dry_run,
      summary: {
        total_input: records.length,
        valid_website_found: valid.length,
        new_staged: newRecords.length,
        already_staged: valid.length - newRecords.length,
        unapplied_processed: unapplied?.length || 0,
        matched, updated, notFound, noChanges, errors, skippedWebsite,
      },
      sample_results: results,
    });
  } catch (error: any) {
    console.error('[bulk-import] Error:', error);
    return json({ ok: false, error: error?.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
