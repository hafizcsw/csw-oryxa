import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { id, locale } = await req.json();
    if (!id) throw new Error("Missing program id");

    const lang = locale || "ar";
    console.log(`[get-program-details] Fetching program: ${id}, locale: ${lang}`);

    const { data, error } = await supabase
      .from("vw_program_details")
      .select("*")
      .eq("program_id", id)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Program not found");

    // Build locale.display contract
    const display: Record<string, string> = {};

    if (lang === "ar") {
      display.university_name = data.university_name_ar || data.university_name || "";
      display.country_name = data.country_name_ar || data.country_name || "";
      display.program_name = data.program_name_ar || data.program_name || "";
      display.degree_name = data.degree_name_ar || data.degree_name || "";
    } else {
      display.university_name = data.university_name_en || data.university_name || "";
      display.country_name = data.country_name_en || data.country_name || "";
      display.program_name = data.program_name_en || data.program_name || "";
      display.degree_name = data.degree_name_en || data.degree_name || "";
    }

    console.log(`[get-program-details] Found: ${display.program_name} (${lang})`);

    // Fetch university geo data
    let geo = null;
    if (data.university_id) {
      const { data: uniGeo } = await supabase
        .from("universities")
        .select("geo_lat, geo_lon, geo_source, geo_confidence")
        .eq("id", data.university_id)
        .single();
      if (uniGeo) geo = uniGeo;
    }

    // Fetch housing locations
    let housingLocations: any[] = [];
    if (data.university_id) {
      const { data: housing } = await supabase
        .from("university_housing_locations")
        .select("id, name, address, lat, lon, price_monthly_local, currency_code, is_primary, status")
        .eq("university_id", data.university_id)
        .eq("status", "published");
      if (housing) housingLocations = housing;
    }

    // Fetch program-specific media (program_id set) + university-wide media (program_id IS NULL)
    let programMedia: any[] = [];
    let universityMedia: any[] = [];
    if (data.university_id) {
      const { data: media } = await supabase
        .from("university_media")
        .select("id, media_kind, image_type, public_url, source_url, alt_text, sort_order, is_primary, program_id")
        .eq("university_id", data.university_id);
      if (media) {
        programMedia = media.filter((m: any) => m.program_id === id);
        universityMedia = media.filter((m: any) => !m.program_id);
      }
    }

    // Related programs
    const { data: related } = await supabase
      .from("vw_program_search")
      .select("*")
      .or(`university_id.eq.${data.university_id},degree_id.eq.${data.degree_id}`)
      .neq("program_id", id)
      .limit(6);

    return new Response(
      JSON.stringify({
        ok: true,
        item: { ...data, locale: { display, lang } },
        geo,
        housingLocations,
        programMedia,
        universityMedia,
        related: related || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (e: any) {
    console.error("[get-program-details] Error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
