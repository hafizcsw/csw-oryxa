import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function etagFor(body: unknown) {
  const s = typeof body === "string" ? body : JSON.stringify(body);
  let h = 0, i = 0, len = s.length;
  while (i < len) h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
  return `W/"${h}"`;
}

Deno.serve(async (req) => {
  const t0 = performance.now();
  const origin = req.headers.get('origin');
  
  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
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
      country_slug = null, 
      type = null,
      date_from = null,
      date_to = null,
      limit = 20, 
      offset = 0 
    } = body;

    console.log('search-events called with:', { country_slug, type, date_from, date_to, limit, offset });

    let query = supabase
      .from('vw_events_search')
      .select('*', { count: 'exact' });

    // Filter by country
    if (country_slug) {
      query = query.eq('country_slug', country_slug);
    }

    // Filter by event type
    if (type) {
      query = query.eq('event_type', type);
    }

    // Filter by date range
    if (date_from) {
      query = query.gte('start_at', date_from);
    }
    if (date_to) {
      query = query.lte('start_at', date_to);
    }

    query = query.order('start_at', { ascending: true });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log(`Found ${count} events`);

    return new Response(
      JSON.stringify({ ok: true, items: data || [], count: count || 0 }),
      { 
        headers: { 
          ...getCorsHeaders(origin), 
          'Content-Type': 'application/json',
          "ETag": etagFor(body),
          "Cache-Control": "public, max-age=60",
          "Server-Timing": `db;dur=${Math.round(performance.now() - t0)}`
        },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in search-events:', error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error), items: [], count: 0 }),
      { 
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});