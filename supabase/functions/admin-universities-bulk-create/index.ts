import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UniversityInput {
  name: string;
  name_en?: string;
  slug?: string;
  country_code?: string;
  country_id?: string;
  country_slug?: string;
  city?: string;
  logo_url?: string;
  hero_image_url?: string;
  ranking?: number;
  website_url?: string;
  description?: string;
  founded_year?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { universities } = await req.json();

    if (!Array.isArray(universities) || universities.length === 0) {
      throw new Error("Universities array is required");
    }

    console.log(`[admin-universities-bulk-create] Processing ${universities.length} universities`);

    // Prepare universities data - resolve country_id for each university
    const universitiesData = await Promise.all(universities.map(async (uni: UniversityInput) => {
      let finalCountryId = uni.country_id;

      // If country_id not provided, try to get it from country_slug or country_code
      if (!finalCountryId && (uni.country_slug || uni.country_code)) {
        const slugOrCode = uni.country_slug || uni.country_code;
        const { data: country, error: countryError } = await supabase
          .from('countries')
          .select('id')
          .or(`slug.eq.${slugOrCode},code.eq.${slugOrCode}`)
          .single();

        if (countryError || !country) {
          console.error(`[admin-universities-bulk-create] Country not found for: ${slugOrCode}`, countryError);
          throw new Error(`Country not found: ${slugOrCode}`);
        }

        finalCountryId = country.id;
      }

      if (!finalCountryId) {
        throw new Error(`No country_id, country_slug, or country_code provided for university: ${uni.name}`);
      }

      return {
        name: uni.name,
        country_id: finalCountryId,
        city: uni.city,
        logo_url: uni.logo_url || null,
        hero_image_url: uni.hero_image_url || null,
        ranking: uni.ranking || null,
        website: uni.website_url || null,
        description: uni.description || null,
        is_active: true,
      };
    }));

    // Insert universities
    const { data: insertedUniversities, error: insertError } = await supabase
      .from('universities')
      .insert(universitiesData)
      .select();

    if (insertError) {
      console.error('[admin-universities-bulk-create] Insert error:', insertError);
      throw insertError;
    }

    console.log(`[admin-universities-bulk-create] Successfully inserted ${insertedUniversities?.length || 0} universities`);

    return new Response(
      JSON.stringify({
        ok: true,
        count: insertedUniversities?.length || 0,
        universities: insertedUniversities,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[admin-universities-bulk-create] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
