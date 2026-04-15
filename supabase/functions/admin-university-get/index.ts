import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authCheck = await requireAdmin(req);
    if (!authCheck.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: authCheck.error }),
        { status: authCheck.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const universityId = url.searchParams.get('id');

    if (!universityId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing university_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { srv } = authCheck;

    // Get university details
    const { data: university, error: uniError } = await srv
      .from('universities')
      .select(`
        *,
        countries:country_id (id, name_ar, slug)
      `)
      .eq('id', universityId)
      .single();

    if (uniError || !university) {
      return new Response(
        JSON.stringify({ ok: false, error: 'University not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get programs
    const { data: programs } = await srv
      .from('programs')
      .select(`
        *,
        degrees:degree_id (id, name, slug)
      `)
      .eq('university_id', universityId)
      .order('title');

    // Get program prices
    const programIds = programs?.map(p => p.id) || [];
    let prices = [];
    if (programIds.length > 0) {
      const { data: pricesData } = await srv
        .from('program_prices')
        .select('*')
        .in('program_id', programIds);
      prices = pricesData || [];
    }

    // Get scholarships
    const { data: scholarships } = await srv
      .from('scholarships')
      .select('*')
      .eq('university_id', universityId)
      .order('created_at', { ascending: false });

    // Get media
    const { data: media } = await srv
      .from('university_media')
      .select('*')
      .eq('university_id', universityId)
      .order('display_order');

    // Get SEO
    const { data: seo } = await srv
      .from('university_seo')
      .select('*')
      .eq('university_id', universityId)
      .maybeSingle();

    // Track telemetry
    await srv.from('analytics_events').insert({
      event: 'admin_university_opened',
      tab: 'universities',
      route: `/admin/universities/${universityId}`,
      payload: { university_id: universityId },
      user_id: authCheck.user.id
    });

    return new Response(
      JSON.stringify({
        ok: true,
        university,
        programs: programs || [],
        prices,
        scholarships: scholarships || [],
        media: media || [],
        seo: seo || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});