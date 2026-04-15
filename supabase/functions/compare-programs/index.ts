import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

/**
 * compare-programs Edge Function
 * Returns a unified comparison table for 2-5 programs
 * Includes highlights, differences, and CSW notes for staff
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json();
    
    const {
      program_ids = [],
      lang = 'ar',
      display_currency_code = 'USD',
      audience = 'public'
    } = body;

    // Validate program_ids
    if (!Array.isArray(program_ids) || program_ids.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 program_ids required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (program_ids.length > 5) {
      return new Response(
        JSON.stringify({ error: 'Maximum 5 programs for comparison' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[compare-programs] Comparing:', program_ids);

    // Fetch programs from SoT view
    const { data: programs, error: progError } = await supabase
      .from('vw_program_search_api')
      .select('*')
      .in('program_id', program_ids);

    if (progError) {
      console.error('[compare-programs] Program fetch error:', progError);
      return new Response(
        JSON.stringify({ error: progError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!programs || programs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No programs found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get FX rate
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
    }

    // Fetch city enrichment data
    const cities = [...new Set(programs.map(p => p.city).filter(Boolean))];
    const { data: cityData } = await supabase
      .from('city_enrichment')
      .select('*')
      .in('city_name', cities);

    const cityMap = new Map(cityData?.map(c => [c.city_name, c]) || []);

    // Fetch CSW guidance for staff
    let guidanceMap = new Map();
    if (audience === 'staff') {
      const { data: uniGuidance } = await supabase
        .from('csw_university_guidance')
        .select('*')
        .in('university_id', programs.map(p => p.university_id));
      
      const { data: progGuidance } = await supabase
        .from('csw_program_guidance')
        .select('*')
        .in('program_id', program_ids);

      uniGuidance?.forEach(g => guidanceMap.set(`uni:${g.university_id}`, g));
      progGuidance?.forEach(g => guidanceMap.set(`prog:${g.program_id}`, g));
    }

    // Build comparison items
    const items = programs.map(prog => {
      const cityInfo = cityMap.get(prog.city);
      const uniGuidance = guidanceMap.get(`uni:${prog.university_id}`);
      const progGuidance = guidanceMap.get(`prog:${prog.program_id}`);

      return {
        program_id: prog.program_id,
        portal_url: prog.portal_url,
        program_name: prog.program_name_ar || prog.program_name,
        university_name: prog.university_name_ar || prog.university_name,
        country_code: prog.country_code,
        city: prog.city,
        degree_slug: prog.degree_slug,
        duration_months: prog.duration_months,
        // Compute duration_years from months (field not in view)
        duration_years: prog.duration_months ? Math.round(prog.duration_months / 12 * 10) / 10 : null,
        languages: prog.languages,
        
        // Tuition in display currency
        tuition_usd_min: prog.tuition_usd_min,
        tuition_usd_max: prog.tuition_usd_max,
        tuition_display_min: prog.tuition_usd_min ? Math.round(prog.tuition_usd_min / fxRate) : null,
        tuition_display_max: prog.tuition_usd_max ? Math.round(prog.tuition_usd_max / fxRate) : null,
        
        // Housing
        has_dorm: prog.has_dorm,
        dorm_price_monthly_usd: prog.dorm_price_monthly_usd,
        dorm_price_monthly_display: prog.dorm_price_monthly_usd 
          ? Math.round(prog.dorm_price_monthly_usd / fxRate) 
          : null,
        
        // City living costs
        city_living_cost_monthly_usd: cityInfo?.living_cost_monthly_usd || prog.monthly_living,
        city_living_cost_monthly_display: cityInfo?.living_cost_monthly_usd 
          ? Math.round(cityInfo.living_cost_monthly_usd / fxRate)
          : prog.monthly_living ? Math.round(prog.monthly_living / fxRate) : null,
        city_rent_monthly_usd: cityInfo?.rent_monthly_usd,
        city_safety_score: cityInfo?.safety_score,
        city_climate: cityInfo?.climate_summary_i18n?.[lang] || cityInfo?.climate_summary_i18n?.en,
        
        // CSW notes for staff only
        ...(audience === 'staff' ? {
          csw_guidance: {
            partner_tier: uniGuidance?.partner_tier,
            csw_star: uniGuidance?.csw_star,
            selling_points: uniGuidance?.selling_points,
            pitch_staff: uniGuidance?.pitch_staff_i18n?.[lang] || uniGuidance?.pitch_staff_i18n?.ar,
            program_notes: progGuidance?.staff_notes,
            csw_recommended: progGuidance?.csw_recommended
          }
        } : {})
      };
    });

    // Calculate highlights (min/max values)
    const highlights = calculateHighlights(items, lang);

    // Log event
    await supabase.from('events').insert({
      name: 'programs_compared',
      properties: { 
        program_ids,
        count: items.length,
        audience
      }
    });

    console.log('[compare-programs] Returning comparison for', items.length, 'programs');

    return new Response(
      JSON.stringify({ 
        ok: true,
        items,
        highlights,
        fx: {
          display_currency_code,
          rate_to_usd: fxRate,
          as_of: fxAsOf
        },
        comparison_fields: getComparisonFields(lang)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[compare-programs] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateHighlights(items: any[], lang: string) {
  const highlights: Record<string, any> = {};
  
  // Cheapest tuition
  const tuitions = items.filter(i => i.tuition_usd_min != null).map(i => ({ id: i.program_id, value: i.tuition_usd_min }));
  if (tuitions.length > 0) {
    const cheapest = tuitions.reduce((a, b) => a.value < b.value ? a : b);
    highlights.cheapest_tuition = {
      program_id: cheapest.id,
      value: cheapest.value,
      label: lang === 'ar' ? 'الأرخص' : 'Cheapest'
    };
  }

  // Shortest duration
  const durations = items.filter(i => i.duration_months != null).map(i => ({ id: i.program_id, value: i.duration_months }));
  if (durations.length > 0) {
    const shortest = durations.reduce((a, b) => a.value < b.value ? a : b);
    highlights.shortest_duration = {
      program_id: shortest.id,
      value: shortest.value,
      label: lang === 'ar' ? 'الأقصر مدة' : 'Shortest'
    };
  }

  // Cheapest dorm
  const dorms = items.filter(i => i.dorm_price_monthly_usd != null).map(i => ({ id: i.program_id, value: i.dorm_price_monthly_usd }));
  if (dorms.length > 0) {
    const cheapestDorm = dorms.reduce((a, b) => a.value < b.value ? a : b);
    highlights.cheapest_dorm = {
      program_id: cheapestDorm.id,
      value: cheapestDorm.value,
      label: lang === 'ar' ? 'أرخص سكن' : 'Cheapest Dorm'
    };
  }

  // Lowest living cost
  const livingCosts = items.filter(i => i.city_living_cost_monthly_usd != null).map(i => ({ id: i.program_id, value: i.city_living_cost_monthly_usd }));
  if (livingCosts.length > 0) {
    const lowestLiving = livingCosts.reduce((a, b) => a.value < b.value ? a : b);
    highlights.lowest_living_cost = {
      program_id: lowestLiving.id,
      value: lowestLiving.value,
      label: lang === 'ar' ? 'أقل تكلفة معيشة' : 'Lowest Living Cost'
    };
  }

  return highlights;
}

function getComparisonFields(lang: string): Record<string, string> {
  const fields: Record<string, Record<string, string>> = {
    ar: {
      university_name: 'الجامعة',
      program_name: 'البرنامج',
      country_code: 'الدولة',
      city: 'المدينة',
      degree_slug: 'الدرجة',
      duration_years: 'المدة (سنوات)',
      languages: 'لغات الدراسة',
      tuition_display_min: 'الرسوم السنوية (من)',
      tuition_display_max: 'الرسوم السنوية (إلى)',
      has_dorm: 'سكن طلابي',
      dorm_price_monthly_display: 'إيجار السكن الشهري',
      city_living_cost_monthly_display: 'تكلفة المعيشة الشهرية',
      city_safety_score: 'مؤشر الأمان',
      city_climate: 'المناخ'
    },
    en: {
      university_name: 'University',
      program_name: 'Program',
      country_code: 'Country',
      city: 'City',
      degree_slug: 'Degree',
      duration_years: 'Duration (years)',
      languages: 'Languages',
      tuition_display_min: 'Annual Tuition (min)',
      tuition_display_max: 'Annual Tuition (max)',
      has_dorm: 'Dormitory',
      dorm_price_monthly_display: 'Monthly Dorm Rent',
      city_living_cost_monthly_display: 'Monthly Living Cost',
      city_safety_score: 'Safety Score',
      city_climate: 'Climate'
    }
  };
  
  return fields[lang] || fields.ar;
}
