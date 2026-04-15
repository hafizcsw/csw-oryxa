import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/auth.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const VERSION = '2026-01-25_sot_view_v1';

function etagFor(body: unknown) {
  const s = typeof body === "string" ? body : JSON.stringify(body);
  let h = 0, i = 0, len = s.length;
  while (i < len) h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
  return `W/"${h}"`;
}

Deno.serve(async (req) => {
  const t0 = performance.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await req.json();
    const reqETag = req.headers.get("if-none-match");
    const tag = etagFor(body);
    
    if (reqETag === tag) {
      return new Response(null, { 
        status: 304, 
        headers: { 
          ...corsHeaders,
          "ETag": tag, 
          "Cache-Control": "public, max-age=60" 
        } 
      });
    }
    
    const { 
      country_code = null,
      country_slug = null,  // Legacy support - prefer country_code
      degree_slug = null,
      degree_id = null,     // Legacy support
      amount_type = null,
      coverage_type = null,
      amount_min = null,
      limit = 20, 
      offset = 0 
    } = body;

    // BLOCKER #1 FIX: Use country_code consistently (not country_slug)
    // The view has both country_code and country_slug - we filter on country_code
    const effectiveCountryCode = country_code || country_slug;
    
    console.log(`[search-scholarships] VERSION=${VERSION}`, { 
      country_code: effectiveCountryCode, 
      degree_slug: degree_slug || degree_id, 
      amount_type,
      coverage_type,
      limit, 
      offset 
    });

    // Use the SoT view: vw_scholarship_search_api
    // Only select explicit columns (not SELECT *)
    let query = supabase
      .from('vw_scholarship_search_api')
      .select(`
        scholarship_id,
        title,
        description,
        status,
        is_active,
        university_id,
        university_name,
        university_logo,
        country_id,
        country_code,
        country_name_ar,
        country_name_en,
        country_slug,
        degree_id,
        degree_slug,
        degree_name,
        study_level,
        amount_type,
        amount_value,
        percent_value,
        currency_code,
        coverage_type,
        deadline,
        link,
        eligibility,
        image_url
      `, { count: 'exact' });

    // Always filter for published + active only
    query = query.eq('status', 'published');
    query = query.eq('is_active', true);

    // BLOCKER #1 FIX: Filter by country_code (not country_slug)
    // This ensures UI sends country_code and Edge filters on country_code
    if (effectiveCountryCode) {
      query = query.eq('country_code', effectiveCountryCode);
    }

    // Filter by degree (support both degree_slug and legacy degree_id)
    const effectiveDegree = degree_slug || degree_id;
    if (effectiveDegree) {
      query = query.eq('degree_slug', effectiveDegree);
    }

    // Filter by amount_type
    if (amount_type) {
      query = query.eq('amount_type', amount_type);
    }

    // Filter by coverage_type
    if (coverage_type) {
      query = query.eq('coverage_type', coverage_type);
    }

    // Filter by minimum amount
    if (amount_min !== null && amount_min > 0) {
      query = query.gte('amount_value', amount_min);
    }

    // Order by amount descending (highest first)
    query = query.order('amount_value', { ascending: false, nullsFirst: false });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[search-scholarships] Database error:', error);
      throw error;
    }

    console.log(`[search-scholarships] Found ${count} scholarships`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        items: data || [], 
        count: count || 0,
        version: VERSION 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          "ETag": etagFor(body),
          "Cache-Control": "public, max-age=60",
          "Server-Timing": `db;dur=${Math.round(performance.now() - t0)}`
        },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[search-scholarships] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error), items: [], count: 0 }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
