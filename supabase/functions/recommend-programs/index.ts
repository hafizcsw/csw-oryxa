import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

/**
 * recommend-programs Edge Function (Legacy - redirects to v2)
 * Maintained for backward compatibility
 */

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(identifier);
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(identifier, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT) {
    return false;
  }
  
  limit.count++;
  return true;
}

// Simple cache
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { visitor_id, user_id, limit = 24 } = await req.json();

    // Rate limiting
    const identifier = user_id || visitor_id || 'anonymous';
    if (!checkRateLimit(identifier)) {
      console.warn('[recommend-programs] Rate limit exceeded:', identifier);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache
    const cacheKey = `recs:${user_id || ''}:${visitor_id || ''}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      console.log('[recommend-programs] Cache hit:', cacheKey);
      return new Response(
        JSON.stringify({ ok: true, items: cached.data, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!visitor_id && !user_id) {
      return new Response(
        JSON.stringify({ error: 'visitor_id or user_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[recommend-programs] Computing for:', { visitor_id, user_id, limit });

    // Use v2 RPC with reason codes
    const { data: recs, error: recError } = await supabase.rpc('compute_recommendations_v2', {
      p_user_id: user_id || null,
      p_visitor_id: visitor_id || null,
      p_filters: {},
      p_audience: 'public',
      p_limit: limit
    });

    if (recError) {
      console.error('Error computing recommendations:', recError);
      return new Response(
        JSON.stringify({ error: recError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!recs || recs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, items: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch program details from SoT view
    const programIds = recs.map((r: any) => r.program_id);
    const { data: programs, error: progError } = await supabase
      .from('vw_program_search_api')
      .select('*')
      .in('program_id', programIds);

    if (progError) {
      console.error('Error fetching programs:', progError);
      return new Response(
        JSON.stringify({ error: progError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Merge scores with program data
    const items = recs.map((r: any) => {
      const prog = programs?.find((p: any) => p.program_id === r.program_id);
      return {
        ...prog,
        recommendation_score: r.score,
        recommendation_reason: r.reason_codes?.[0] || 'popularity',
        reason_codes: r.reason_codes || []
      };
    }).filter((item: any) => item.program_id);

    // Log event
    await supabase.from('events').insert({
      name: 'recommendations_viewed',
      visitor_id: visitor_id || null,
      properties: { 
        user_id: user_id || null,
        count: items.length, 
        strategy: 'v2_with_guidance' 
      }
    });

    console.log('[recommend-programs] Returning', items.length, 'recommendations');

    // Store in cache
    cache.set(cacheKey, { data: items, expires: Date.now() + CACHE_TTL });

    return new Response(
      JSON.stringify({ ok: true, items }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('recommend-programs error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
