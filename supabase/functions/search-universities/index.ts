// LAV #15.B1: Search Universities with Filters (Enhanced with Degree/Certificate)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight, generateTraceId, slog } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

function etagFor(body: unknown) {
  const s = typeof body === "string" ? body : JSON.stringify(body);
  let h = 0, i = 0, len = s.length;
  while (i < len) h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
  return `W/"${h}"`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const tid = generateTraceId();
  const t0 = performance.now();

  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) {
    slog({ tid, kind: 'preflight', origin });
    return preflightResponse;
  }

  try {
    const body = await req.json();
    const reqETag = req.headers.get("if-none-match");
    const tag = etagFor(body);
    
    if (reqETag === tag) {
      return new Response(null, { 
        status: 304, 
        headers: { 
          ...getCorsHeaders(origin),
          "ETag": tag, 
          "Cache-Control": "public, max-age=60" 
        } 
      });
    }
    const {
      q_name = null,
      country_slug = null,
      fees_min = null,
      fees_max = null,
      living_min = null,
      living_max = null,
      degree_id = null,
      certificate_id = null,
      sort = 'popularity',
      limit = 20,
      offset = 0
    } = body || {};

    slog({
      tid,
      evt: 'search_start',
      filters: { q_name, country_slug, fees_min, fees_max, living_min, living_max, degree_id, certificate_id, sort, limit, offset }
    });

    // Build query on the new university card view
    let query = supabase
      .from('vw_university_card')
      .select('*', { count: 'exact' });

    // Apply filters
    if (q_name) query = query.ilike('name', `%${q_name}%`);
    if (country_slug) query = query.eq('country_slug', country_slug);
    if (fees_min !== null) query = query.gte('annual_fees', fees_min);
    if (fees_max !== null) query = query.lte('annual_fees', fees_max);
    if (living_min !== null) query = query.gte('monthly_living', living_min);
    if (living_max !== null) query = query.lte('monthly_living', living_max);

    // Filter by degree if provided (degree_ids is now in vw_university_card)
    if (degree_id) {
      try {
        query = query.contains('degree_ids', [degree_id]);
      } catch (e) {
        slog({ tid, warning: 'degree_id filter failed', error: String(e) });
      }
    }

    // Apply sorting
    switch (sort) {
      case 'name_asc':
        query = query.order('name', { ascending: true });
        break;
      case 'name_desc':
        query = query.order('name', { ascending: false });
        break;
      case 'fees_asc':
        query = query.order('annual_fees', { ascending: true, nullsFirst: false });
        break;
      case 'fees_desc':
        query = query.order('annual_fees', { ascending: false, nullsFirst: false });
        break;
      case 'rank_asc':
        query = query.order('qs_world_rank', { ascending: true, nullsFirst: false });
        break;
      case 'rank_desc':
        query = query.order('qs_world_rank', { ascending: false, nullsFirst: false });
        break;
      default: // popularity ≈ ranking
        query = query.order('qs_world_rank', { ascending: true, nullsFirst: false });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const tQueryStart = performance.now();
    const { data, error, count } = await query;
    const tQueryEnd = performance.now();
    const queryDur = Math.round(tQueryEnd - tQueryStart);

    if (error) {
      slog({
        tid,
        level: 'error',
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        dur_ms: Math.round(performance.now() - t0)
      });
      throw error;
    }

    const totalDur = Math.round(performance.now() - t0);

    slog({
      tid,
      evt: 'search_ok',
      count,
      items_returned: data?.length || 0,
      filters: { q_name, country_slug, fees_min, fees_max, living_min, living_max, degree_id, certificate_id, sort },
      dur_ms: totalDur
    });

    return new Response(
      JSON.stringify({ ok: true, tid, count, items: data || [] }),
      {
        status: 200,
        headers: { 
          ...getCorsHeaders(origin), 
          'Content-Type': 'application/json',
          "ETag": etagFor(body),
          "Cache-Control": "public, max-age=60",
          "Server-Timing": `db;dur=${queryDur}, total;dur=${totalDur}`
        }
      }
    );
  } catch (e: any) {
    slog({
      tid,
      level: 'error',
      error: String(e),
      message: e.message,
      stack: e.stack,
      dur_ms: Math.round(performance.now() - t0)
    });

    return new Response(
      JSON.stringify({ ok: false, tid, error: String(e), message: e.message }),
      {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    );
  }
});
