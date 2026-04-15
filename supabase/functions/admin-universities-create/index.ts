import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifyAdminJWT } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { getCorsHeaders, handleCorsPreflight, generateTraceId, slog } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  const tid = generateTraceId();
  const t0 = performance.now();

  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) {
    slog({ tid, kind: "preflight", origin });
    return preflightResponse;
  }

  try {
    const payload = await verifyAdminJWT(req.headers.get('authorization'));
    if (!payload) {
      slog({ tid, level: "warn", error: "Unauthorized", dur_ms: Math.round(performance.now() - t0) });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { name, country_id, country_slug, city, ranking, annual_fees, monthly_living, description, website, logo_url, is_active } = body;

    if (!name || (!country_id && !country_slug)) {
      slog({ tid, level: "warn", error: "Missing required fields", dur_ms: Math.round(performance.now() - t0) });
      return new Response(JSON.stringify({ error: 'name and (country_id or country_slug) are required' }), {
        status: 400,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // Get country ID (accept either id or slug)
    let finalCountryId = country_id;
    if (!finalCountryId && country_slug) {
      const { data: country, error: countryError } = await supabase
        .from('countries')
        .select('id')
        .eq('slug', country_slug)
        .single();

      if (countryError || !country) {
        slog({ tid, level: "warn", error: "Invalid country_slug", dur_ms: Math.round(performance.now() - t0) });
        return new Response(JSON.stringify({ error: 'Invalid country_slug' }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        });
      }
      finalCountryId = country.id;
    }

    // Create university
    const { data, error } = await supabase
      .from('universities')
      .insert([{
        name,
        country_id: finalCountryId,
        city,
        ranking,
        annual_fees,
        monthly_living,
        description,
        website,
        logo_url,
        is_active: is_active ?? true,
      }])
      .select()
      .single();

    if (error) {
      slog({ tid, level: "error", error: error.message, dur_ms: Math.round(performance.now() - t0) });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    slog({ tid, path: "/admin-universities-create", method: "POST", status: 200, dur_ms: Math.round(performance.now() - t0) });
    return new Response(JSON.stringify({ ok: true, university: data, tid }), {
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  } catch (error) {
    slog({ tid, level: "error", error: String(error), dur_ms: Math.round(performance.now() - t0) });
    return new Response(JSON.stringify({ error: 'Internal server error', tid }), {
      status: 500,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
  }
});
