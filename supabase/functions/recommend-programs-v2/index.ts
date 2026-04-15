import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

/**
 * recommend-programs-v2 Edge Function
 * Returns personalized program recommendations with reason codes
 * Supports audience gating (public vs staff)
 */

// Rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
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

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    
    const {
      visitor_id,
      user_id,
      filters = {},
      audience = 'public',
      lang = 'ar',
      display_currency_code = 'USD',
      limit = 24
    } = body;

    // Rate limiting
    const identifier = user_id || visitor_id || 'anonymous';
    if (!checkRateLimit(identifier)) {
      console.warn('[recommend-programs-v2] Rate limit exceeded:', identifier);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache - MUST include lang + display_currency_code to prevent wrong results
    const cacheKey = `recs2:${user_id || ''}:${visitor_id || ''}:${JSON.stringify(filters)}:${audience}:${lang}:${display_currency_code}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      console.log('[recommend-programs-v2] Cache hit');
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

    console.log('[recommend-programs-v2] Computing recommendations:', { visitor_id, user_id, audience, limit });

    // Call compute_recommendations_v2 RPC
    const { data: recs, error: recError } = await supabase.rpc('compute_recommendations_v2', {
      p_user_id: user_id || null,
      p_visitor_id: visitor_id || null,
      p_filters: filters,
      p_audience: audience,
      p_limit: limit
    });

    if (recError) {
      console.error('[recommend-programs-v2] RPC error:', recError);
      return new Response(
        JSON.stringify({ error: recError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!recs || recs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, items: [], reason_codes_legend: getReasonCodesLegend(lang) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch full program details from SoT view
    const programIds = recs.map((r: any) => r.program_id);
    const { data: programs, error: progError } = await supabase
      .from('vw_program_search_api')
      .select('*')
      .in('program_id', programIds);

    if (progError) {
      console.error('[recommend-programs-v2] Program fetch error:', progError);
      return new Response(
        JSON.stringify({ error: progError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get FX rate for display currency
    let fxRate = 1;
    let fxAsOf: string | null = null;
    
    if (display_currency_code !== 'USD') {
      const { data: fxData } = await supabase
        .from('fx_rates_latest')
        .select('rate_to_usd, as_of_date')
        .eq('currency_code', display_currency_code.toUpperCase())
        .single();
      
      if (fxData) {
        fxRate = fxData.rate_to_usd;
        fxAsOf = fxData.as_of_date;
      }
    } else {
      // Get USD timestamp
      const { data: usdFx } = await supabase
        .from('fx_rates')
        .select('updated_at')
        .eq('currency_code', 'USD')
        .single();
      fxAsOf = usdFx?.updated_at || new Date().toISOString();
    }

    // Merge recommendations with program data
    const items = recs.map((r: any) => {
      const prog = programs?.find((p: any) => p.program_id === r.program_id);
      if (!prog) return null;

      return {
        ...prog,
        recommendation_score: r.score,
        reason_codes: r.reason_codes || [],
        // Staff-only guidance
        ...(audience === 'staff' && r.guidance ? { csw_guidance: r.guidance } : {}),
        // Display currency conversion
        tuition_display_min: prog.tuition_usd_min ? Math.round(prog.tuition_usd_min / fxRate) : null,
        tuition_display_max: prog.tuition_usd_max ? Math.round(prog.tuition_usd_max / fxRate) : null,
        dorm_price_monthly_display: prog.dorm_price_monthly_usd 
          ? Math.round(prog.dorm_price_monthly_usd / fxRate) 
          : null
      };
    }).filter(Boolean);

    // Log event
    await supabase.from('events').insert({
      name: 'recommendations_v2_viewed',
      visitor_id: visitor_id || null,
      properties: { 
        user_id: user_id || null,
        count: items.length, 
        audience,
        top_reasons: items.slice(0, 5).flatMap((i: any) => i.reason_codes || [])
      }
    });

    console.log('[recommend-programs-v2] Returning', items.length, 'recommendations');

    // Cache results
    cache.set(cacheKey, { data: items, expires: Date.now() + CACHE_TTL });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        items,
        fx: {
          display_currency_code,
          rate_to_usd: fxRate,
          as_of: fxAsOf
        },
        reason_codes_legend: getReasonCodesLegend(lang)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[recommend-programs-v2] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Reason codes legend with i18n
function getReasonCodesLegend(lang: string): Record<string, string> {
  const legends: Record<string, Record<string, string>> = {
    ar: {
      CSW_STAR: '⭐ جامعة مميزة',
      CSW_RECOMMENDED: '✓ موصى به من الفريق',
      PARTNER_PRIORITY: '🤝 شريك معتمد',
      BUDGET_FIT: '💰 ضمن الميزانية',
      HAS_DORM: '🏠 سكن متوفر',
      LOW_TUITION: '💵 رسوم منخفضة',
      MID_TUITION: '💵 رسوم متوسطة',
      HIGH_QUALITY: '🎓 جودة عالية',
      FAST_ADMISSION: '⚡ قبول سريع'
    },
    en: {
      CSW_STAR: '⭐ Featured University',
      CSW_RECOMMENDED: '✓ Team Recommended',
      PARTNER_PRIORITY: '🤝 Certified Partner',
      BUDGET_FIT: '💰 Within Budget',
      HAS_DORM: '🏠 Dormitory Available',
      LOW_TUITION: '💵 Low Tuition',
      MID_TUITION: '💵 Mid-Range Tuition',
      HIGH_QUALITY: '🎓 High Quality',
      FAST_ADMISSION: '⚡ Fast Admission'
    }
  };
  
  return legends[lang] || legends.ar;
}
