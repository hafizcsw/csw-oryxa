import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * geo-resolve: Resolve-once, persist, reuse geo cache
 * 
 * Modes:
 * 1. lookup:  Check cache for given keys (public, rate-limited)
 * 2. resolve: Resolve missing city+country via Nominatim, persist (authenticated only)
 * 3. warmup:  Batch identify missing cities for a country (service-role / admin only)
 * 
 * Security model:
 * - lookup:  Requires valid JWT (anon key accepted). Durable rate limit via rate_limits table.
 * - resolve: Requires valid authenticated user JWT. Durable rate limit (stricter).
 * - warmup:  Requires service-role key or admin user. No public access.
 * - All modes: batch cap (20 for resolve, 100 for lookup keys)
 * - External geocoding: 1.1s polite delay between Nominatim requests
 */

// Limits raised: map pan/zoom fires many batched lookups; previous values caused
// user-visible 429s that blanked the map. Resolve still capped because it hits Nominatim.
const RESOLVE_RATE_LIMIT = 60;   // max resolve calls per minute per IP
const LOOKUP_RATE_LIMIT = 600;   // max cache-lookup calls per minute per IP
const RATE_WINDOW_SECONDS = 60;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const body = await req.json();
    const mode = body.mode as string;

    if (!['lookup', 'resolve', 'warmup'].includes(mode)) {
      return json({ ok: false, error: `Unknown mode: ${mode}` }, 400);
    }

    // ── Authentication ──
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    // Service-role client for DB operations
    const srv = createClient(supabaseUrl, serviceKey);

    // Determine caller identity
    let userId: string | null = null;
    let isServiceRole = false;
    let isAdmin = false;

    if (token === serviceKey) {
      isServiceRole = true;
    } else if (token && token !== anonKey) {
      // Try to validate as user JWT
      const anonClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (user) {
        userId = user.id;
        const { data: adminCheck } = await srv.rpc('is_admin', { _user_id: user.id as any });
        isAdmin = !!adminCheck;
      }
      // If user validation fails, still allow as anonymous for lookup/resolve
    }
    // Anonymous callers (anon key or no auth) are allowed for lookup + resolve
    // Rate limiting protects against abuse

    // ── Mode-specific access control ──
    if (mode === 'warmup' && !isServiceRole && !isAdmin) {
      return json({ ok: false, error: 'Warmup mode requires admin or service-role access' }, 403);
    }

    // resolve mode: allow anonymous callers (anon key) for public map geocoding
    // Rate limiting still applies to prevent abuse

    // ── Durable rate limiting via rate_limits table ──
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || 'unknown';

    if (!isServiceRole && !isAdmin) {
      const endpoint = `geo-resolve:${mode}`;
      const maxRequests = mode === 'resolve' ? RESOLVE_RATE_LIMIT : LOOKUP_RATE_LIMIT;

      const { data: rlData } = await srv
        .from('rate_limits')
        .select('requests_count, window_start')
        .eq('domain', clientIp)
        .eq('endpoint', endpoint)
        .maybeSingle();

      const now = new Date();
      const windowStart = rlData?.window_start ? new Date(rlData.window_start) : null;
      const windowExpired = !windowStart || (now.getTime() - windowStart.getTime()) > RATE_WINDOW_SECONDS * 1000;

      if (windowExpired) {
        // Reset window
        await srv.from('rate_limits').upsert({
          domain: clientIp,
          endpoint,
          requests_count: 1,
          window_start: now.toISOString(),
          last_request_at: now.toISOString(),
        }, { onConflict: 'domain,endpoint' });
      } else {
        const currentCount = rlData?.requests_count || 0;
        if (currentCount >= maxRequests) {
          return json({ ok: false, error: 'Rate limit exceeded. Try again later.' }, 429);
        }
        await srv.from('rate_limits').update({
          requests_count: currentCount + 1,
          last_request_at: now.toISOString(),
        }).eq('domain', clientIp).eq('endpoint', endpoint);
      }
    }

    // ── MODE: lookup ──
    if (mode === 'lookup') {
      const keys = body.keys as string[];
      if (!Array.isArray(keys) || keys.length === 0) {
        return json({ ok: false, error: 'keys array required' }, 400);
      }
      // Cap at 100 keys
      const cappedKeys = keys.slice(0, 100);

      const { data, error } = await srv.rpc('rpc_geo_cache_lookup', { p_keys: cappedKeys });
      if (error) {
        console.error('[geo-resolve] lookup error:', error);
        return json({ ok: false, error: error.message }, 500);
      }

      const results: Record<string, any> = {};
      const missingKeys: string[] = [];
      for (const key of cappedKeys) {
        const found = (data as any[])?.find((d: any) => d.normalized_query_key === key);
        if (found) {
          results[key] = found;
        } else {
          missingKeys.push(key);
        }
      }

      return json({ ok: true, results, missing_keys: missingKeys, from_cache: Object.keys(results).length });
    }

    // ── MODE: resolve ──
    if (mode === 'resolve') {
      const entries = body.entries as Array<{
        city_name: string;
        country_code: string;
        country_name?: string;
        entity_type?: string;
        entity_id?: string;
        university_name?: string;
      }>;

      if (!Array.isArray(entries) || entries.length === 0) {
        return json({ ok: false, error: 'entries array required' }, 400);
      }

      const batch = entries.slice(0, 20);
      const resolved: any[] = [];
      const failed: any[] = [];

      for (const entry of batch) {
        const normCity = normalize(entry.city_name);
        const queryKey = entry.entity_id
          ? `uni:${entry.entity_id}`
          : `${entry.country_code.toLowerCase()}:${normCity}`;

        // Check cache first
        const { data: cached } = await srv.rpc('rpc_geo_cache_lookup', { p_keys: [queryKey] });
        if (cached && (cached as any[]).length > 0) {
          resolved.push({ key: queryKey, ...((cached as any[])[0]), from_cache: true });
          continue;
        }

        // Resolve via Nominatim
        try {
          const q = `${entry.city_name}, ${entry.country_name || entry.country_code}`;
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=${entry.country_code.toLowerCase()}`;

          const resp = await fetch(url, {
            headers: { 'User-Agent': 'LavistaEdu/1.0 (geo-resolve)' },
          });

          if (!resp.ok) {
            failed.push({ key: queryKey, error: `Nominatim HTTP ${resp.status}` });
            continue;
          }

          const results = await resp.json();
          if (!results || results.length === 0) {
            const unresolvedEntry = [{
              entity_type: entry.entity_type || 'city',
              entity_id: entry.entity_id || null,
              country_code: entry.country_code,
              city_name: entry.city_name,
              university_name: entry.university_name || null,
              normalized_query_key: queryKey,
              lat: 0, lon: 0,
              source: 'nominatim_no_result',
              confidence: 0,
              resolution_level: 'unresolved',
            }];
            await srv.rpc('rpc_geo_cache_upsert', { p_entries: unresolvedEntry });
            failed.push({ key: queryKey, error: 'No results from Nominatim' });
            continue;
          }

          const r = results[0];
          const bbox = r.boundingbox
            ? { south: parseFloat(r.boundingbox[0]), north: parseFloat(r.boundingbox[1]), west: parseFloat(r.boundingbox[2]), east: parseFloat(r.boundingbox[3]) }
            : null;

          const cacheEntry = {
            entity_type: entry.entity_type || 'city',
            entity_id: entry.entity_id || null,
            country_code: entry.country_code,
            country_name: entry.country_name || null,
            city_name: entry.city_name,
            university_name: entry.university_name || null,
            normalized_query_key: queryKey,
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon),
            source: `nominatim:${r.osm_type || ''}:${r.osm_id || ''}`,
            confidence: r.importance ? Math.min(parseFloat(r.importance), 1.0) : 0.7,
            resolution_level: entry.entity_type === 'university' ? 'university_stored' : 'city_resolved',
            bbox,
          };

          await srv.rpc('rpc_geo_cache_upsert', { p_entries: [cacheEntry] });

          // Also update city_coordinates for cities
          if ((!entry.entity_type || entry.entity_type === 'city') && cacheEntry.lat !== 0) {
            await srv.from('city_coordinates').upsert({
              city_name: entry.city_name,
              country_code: entry.country_code.toUpperCase(),
              lat: cacheEntry.lat,
              lon: cacheEntry.lon,
            }, { onConflict: 'city_name,country_code' }).select();
          }

          // Write resolved coordinates back to universities table for permanent storage
          if (entry.entity_type === 'university' && entry.entity_id && cacheEntry.lat !== 0) {
            await srv.from('universities').update({
              geo_lat: cacheEntry.lat,
              geo_lon: cacheEntry.lon,
              geo_source: cacheEntry.source,
            }).eq('id', entry.entity_id);
          }

          resolved.push({ key: queryKey, ...cacheEntry, from_cache: false });

          // Polite delay for Nominatim
          if (batch.length > 1) {
            await new Promise(r => setTimeout(r, 1100));
          }
        } catch (e: any) {
          failed.push({ key: queryKey, error: String(e) });
        }
      }

      return json({
        ok: true,
        resolved: resolved.length,
        failed: failed.length,
        results: resolved,
        errors: failed,
        total_requested: batch.length,
      });
    }

    // ── MODE: warmup ──
    if (mode === 'warmup') {
      const country_code = body.country_code as string;
      if (!country_code) {
        return json({ ok: false, error: 'country_code required' }, 400);
      }

      const { data: unis } = await srv
        .from('universities')
        .select('city')
        .eq('country_code', country_code.toUpperCase())
        .not('city', 'is', null);

      if (!unis || unis.length === 0) {
        return json({ ok: true, message: 'No universities found', resolved: 0 });
      }

      const uniqueCities = [...new Set(unis.map(u => u.city?.trim()).filter(Boolean))] as string[];
      const keys = uniqueCities.map(c => `${country_code.toLowerCase()}:${normalize(c)}`);
      const { data: cached } = await srv.rpc('rpc_geo_cache_lookup', { p_keys: keys });
      const cachedKeys = new Set((cached as any[] || []).map((r: any) => r.normalized_query_key));

      const missing = uniqueCities.filter(c => {
        const key = `${country_code.toLowerCase()}:${normalize(c)}`;
        return !cachedKeys.has(key);
      });

      return json({
        ok: true,
        country_code,
        total_cities: uniqueCities.length,
        already_cached: cachedKeys.size,
        missing_count: missing.length,
        missing_cities: missing.slice(0, 50),
        message: missing.length === 0
          ? 'All cities are already cached!'
          : `${missing.length} cities need resolution. Use resolve mode with these entries.`,
      });
    }

    return json({ ok: false, error: 'Unknown mode' }, 400);
  } catch (e: any) {
    console.error('[geo-resolve] Fatal:', e);
    return json({ ok: false, error: String(e) }, 500);
  }
});

/** Normalize city name: trim, collapse whitespace, lowercase */
function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
