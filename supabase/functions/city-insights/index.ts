import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

/**
 * city-insights Edge Function
 * Returns city enrichment data for living costs, climate, safety
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    
    // Support both GET (query params) and POST (body)
    let city_name: string | null = null;
    let country_code: string | null = null;
    let lang = 'ar';
    let display_currency_code = 'USD';

    if (req.method === 'GET') {
      city_name = url.searchParams.get('city');
      country_code = url.searchParams.get('country_code');
      lang = url.searchParams.get('lang') || 'ar';
      display_currency_code = url.searchParams.get('currency') || 'USD';
    } else {
      const body = await req.json();
      city_name = body.city_name;
      country_code = body.country_code;
      lang = body.lang || 'ar';
      display_currency_code = body.display_currency_code || 'USD';
    }

    if (!city_name) {
      return new Response(
        JSON.stringify({ error: 'city_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[city-insights] Fetching:', { city_name, country_code });

    // Build query
    let query = supabase
      .from('city_enrichment')
      .select('*')
      .ilike('city_name', city_name);

    if (country_code) {
      query = query.eq('country_code', country_code.toUpperCase());
    }

    const { data: cityData, error } = await query.maybeSingle();

    if (error) {
      console.error('[city-insights] Query error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cityData) {
      return new Response(
        JSON.stringify({ 
          ok: true, 
          found: false, 
          city_name,
          message: lang === 'ar' ? 'لم يتم العثور على بيانات المدينة' : 'City data not found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get FX rate for display currency
    let fxRate = 1;
    if (display_currency_code !== 'USD') {
      const { data: fxData } = await supabase
        .from('fx_rates_latest')
        .select('rate_to_usd')
        .eq('currency_code', display_currency_code.toUpperCase())
        .single();
      
      if (fxData) {
        fxRate = fxData.rate_to_usd;
      }
    }

    // Format response
    const response = {
      ok: true,
      found: true,
      city_name: cityData.city_name,
      country_code: cityData.country_code,
      
      // Costs in USD
      living_cost_monthly_usd: cityData.living_cost_monthly_usd,
      rent_monthly_usd: cityData.rent_monthly_usd,
      
      // Costs in display currency
      living_cost_monthly_display: cityData.living_cost_monthly_usd 
        ? Math.round(cityData.living_cost_monthly_usd / fxRate) 
        : null,
      rent_monthly_display: cityData.rent_monthly_usd 
        ? Math.round(cityData.rent_monthly_usd / fxRate) 
        : null,
      
      // Scores
      safety_score: cityData.safety_score,
      quality_of_life_score: cityData.quality_of_life_score,
      healthcare_score: cityData.healthcare_score,
      transport_score: cityData.transport_score,
      internet_speed_mbps: cityData.internet_speed_mbps,
      
      // Climate (i18n)
      climate_summary: cityData.climate_summary_i18n?.[lang] 
        || cityData.climate_summary_i18n?.en 
        || cityData.climate_summary_i18n?.ar,
      
      // Meta
      display_currency_code,
      data_source: cityData.data_source,
      last_updated_at: cityData.last_updated_at
    };

    console.log('[city-insights] Returning data for:', city_name);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[city-insights] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
