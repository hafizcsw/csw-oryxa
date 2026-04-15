import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

// Simple in-memory cache with TTL (10 minutes)
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { country_slug, degree_slug, visitor_id, limit = 20 } = await req.json();

    // Rate limiting
    const identifier = visitor_id || 'anonymous';
    if (!checkRateLimit(identifier)) {
      console.warn('[scholarships-suggest] Rate limit exceeded:', identifier);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache
    const cacheKey = `schol:${country_slug || ''}:${degree_slug || ''}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      console.log('[scholarships-suggest] Cache hit:', cacheKey);
      return new Response(
        JSON.stringify({ ok: true, items: cached.data, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[scholarships-suggest] Request:', { country_slug, degree_slug, limit });

    let query = supabase
      .from('scholarships')
      .select(`
        id,
        title,
        amount,
        currency,
        deadline,
        url,
        country_id,
        degree_id,
        countries (slug, name_ar),
        degrees (slug, name)
      `)
      .eq('status', 'published')
      .order('deadline', { ascending: true })
      .limit(limit);

    // Apply filters if provided
    if (country_slug) {
      const { data: country } = await supabase
        .from('countries')
        .select('id')
        .eq('slug', country_slug)
        .single();
      
      if (country) {
        query = query.eq('country_id', country.id);
      }
    }

    if (degree_slug) {
      const { data: degree } = await supabase
        .from('degrees')
        .select('id')
        .eq('slug', degree_slug)
        .single();
      
      if (degree) {
        query = query.eq('degree_id', degree.id);
      }
    }

    const { data: scholarships, error } = await query;

    if (error) {
      console.error('Error fetching scholarships:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log event
    await supabase.from('events').insert({
      name: 'scholarships_suggested',
      visitor_id: visitor_id || null,
      properties: { 
        country: country_slug || null,
        degree: degree_slug || null,
        count: scholarships?.length || 0
      }
    });

    console.log('[scholarships-suggest] Returning', scholarships?.length || 0, 'scholarships');

    // Store in cache
    cache.set(cacheKey, { data: scholarships || [], expires: Date.now() + CACHE_TTL });

    return new Response(
      JSON.stringify({ ok: true, items: scholarships || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('scholarships-suggest error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
