import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UniversityRecord {
  name_en: string;
  country_code: string;
  official_website: string;
  map_location: string;
}

async function geocodeLocation(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LaVista-University-Geocoder/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

// Extract city from map_location: take the part after the university name, before the country
function extractCityFromMapLocation(mapLocation: string): string | null {
  // Format: "University Name, City, State/Region, Country"
  const parts = mapLocation.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    // City is usually the second part (after uni name)
    return parts[1];
  }
  if (parts.length === 2) {
    return parts[0]; // might be "City, Country"
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Check admin role
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
    }

    const { records } = await req.json() as { records: UniversityRecord[] };
    console.log(`[bulk-update] Processing ${records.length} universities`);

    let matched = 0;
    let notFound = 0;
    let geocoded = 0;
    let geocodeFailed = 0;
    const results: any[] = [];

    for (const record of records) {
      // Rate limit for Nominatim (1 req/sec)
      await new Promise(r => setTimeout(r, 1100));

      // Match by name (case-insensitive)
      const { data: uni } = await supabase
        .from('universities')
        .select('id, name, website, city, country_code, geo_lat, geo_lon')
        .ilike('name', record.name_en.trim())
        .maybeSingle();

      if (!uni) {
        notFound++;
        results.push({ name: record.name_en, status: 'not_found' });
        continue;
      }

      matched++;

      // Prepare update payload
      const updates: Record<string, any> = {};

      // Update website if missing or different
      if (record.official_website && (!uni.website || uni.website === '')) {
        updates.website = record.official_website;
      }

      // Update country_code if missing
      if (record.country_code && (!uni.country_code || uni.country_code === '')) {
        updates.country_code = record.country_code;
      }

      // Extract and update city from map_location
      const city = extractCityFromMapLocation(record.map_location);
      if (city && (!uni.city || uni.city === '' || uni.city === 'Beijing' || uni.city === 'New Delhi' || uni.city === 'New York' || uni.city === 'Tokyo' || uni.city === 'Moscow' || uni.city === 'Paris')) {
        updates.city = city;
      }

      // Geocode if no existing coordinates
      if (!uni.geo_lat || !uni.geo_lon) {
        const geo = await geocodeLocation(record.map_location);
        if (geo && geo.lat !== 0 && geo.lon !== 0) {
          updates.geo_lat = geo.lat;
          updates.geo_lon = geo.lon;
          updates.geo_source = 'spreadsheet_nominatim';
          updates.geo_confidence = 0.8;
          geocoded++;
        } else {
          geocodeFailed++;
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('universities')
          .update(updates)
          .eq('id', uni.id);

        if (updateError) {
          console.error(`[bulk-update] Update failed for ${uni.name}:`, updateError);
          results.push({ name: record.name_en, id: uni.id, status: 'update_error', error: updateError.message });
        } else {
          results.push({ name: record.name_en, id: uni.id, status: 'updated', updates: Object.keys(updates) });
        }
      } else {
        results.push({ name: record.name_en, id: uni.id, status: 'no_changes_needed' });
      }

      if ((matched + notFound) % 50 === 0) {
        console.log(`[bulk-update] Progress: ${matched + notFound}/${records.length}`);
      }
    }

    console.log(`[bulk-update] Done — Matched: ${matched}, Not found: ${notFound}, Geocoded: ${geocoded}, Geocode failed: ${geocodeFailed}`);

    return new Response(
      JSON.stringify({
        ok: true,
        summary: { total: records.length, matched, notFound, geocoded, geocodeFailed },
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[bulk-update] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
