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
    const { id, country_id, country_slug, ...updates } = body;

    if (!id) {
      slog({ tid, level: "warn", error: "Missing id", dur_ms: Math.round(performance.now() - t0) });
      return new Response(JSON.stringify({ error: 'id is required' }), {
        status: 400,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();
    let finalUpdates = { ...updates };

    // If country_id or country_slug provided, resolve to country_id
    if (country_id) {
      finalUpdates.country_id = country_id;
    } else if (country_slug) {
      const { data: country } = await supabase
        .from('countries')
        .select('id')
        .eq('slug', country_slug)
        .single();

      if (country) {
        finalUpdates.country_id = country.id;
      }
    }

    const { data, error } = await supabase
      .from('universities')
      .update(finalUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      slog({ tid, level: "error", error: error.message, dur_ms: Math.round(performance.now() - t0) });
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    slog({ tid, path: "/admin-universities-update", method: "POST", status: 200, dur_ms: Math.round(performance.now() - t0) });
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
