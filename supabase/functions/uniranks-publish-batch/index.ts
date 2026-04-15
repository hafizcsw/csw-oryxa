import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    let userId = 'system-batch';
    
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      if (user) userId = user.id;
    }

    console.log(`[publish-batch] Starting for user ${userId}`);

    // 1️⃣ Count pending staging records
    const { count: totalImported } = await supabase
      .from('university_import_staging')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'uniranks')
      .eq('status', 'pending');

    console.log(`[publish-batch] Pending to import: ${totalImported}`);

    // 2️⃣ Existing universities count
    const { count: existingCount } = await supabase
      .from('universities')
      .select('*', { count: 'exact', head: true });

    console.log(`[publish-batch] Existing universities: ${existingCount}`);

    // 3️⃣ Process pending records with strict deduplication
    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    const { data: stagingData, error: stagingError } = await supabase
      .from('university_import_staging')
      .select('*')
      .eq('source', 'uniranks')
      .eq('status', 'pending')
      .limit(500);

    if (stagingError) throw stagingError;

    for (const record of stagingData || []) {
      try {
        const uniName = record.name || '';
        const uniCountry = record.country_name || '';

        // Extract uniranks_slug from external_id (e.g., "uniranks_mit" → "mit")
        const uniranksSlug = record.external_id
          ? record.external_id.replace('uniranks_', '')
          : null;

        // ========== STRICT DEDUP HIERARCHY ==========

        // Step 1: Match by uniranks_slug (exact, highest priority)
        let existingId: string | null = null;

        if (uniranksSlug) {
          const { data: bySlug } = await supabase
            .from('universities')
            .select('id, name')
            .eq('uniranks_slug', uniranksSlug)
            .maybeSingle();

          if (bySlug) {
            existingId = bySlug.id;
            console.log(`[publish-batch] SLUG MATCH: "${uniName}" → ${bySlug.name} (${bySlug.id})`);
          }
        }

        // Step 2: Match by exact name (case-insensitive, NO wildcards)
        if (!existingId && uniName) {
          const { data: byName } = await supabase
            .from('universities')
            .select('id, name')
            .ilike('name', uniName.trim())
            .maybeSingle();

          if (byName) {
            existingId = byName.id;
            console.log(`[publish-batch] NAME MATCH: "${uniName}" → ${byName.name} (${byName.id})`);
          }
        }

        // ========== HANDLE MATCH (UPDATE) ==========
        if (existingId) {
          duplicates++;

          // Set uniranks_slug if not already set
          if (uniranksSlug) {
            await supabase
              .from('universities')
              .update({ uniranks_slug: uniranksSlug })
              .eq('id', existingId)
              .is('uniranks_slug', null);
          }

          // Update ranking data
          if (record.rank) {
            // Try update first
            const { data: existingRanking } = await supabase
              .from('institution_rankings')
              .select('id')
              .eq('institution_id', existingId)
              .eq('ranking_system', 'uniranks')
              .maybeSingle();

            if (existingRanking) {
              await supabase
                .from('institution_rankings')
                .update({
                  world_rank: record.rank,
                  overall_score: record.score,
                  ranking_year: new Date().getFullYear(),
                })
                .eq('id', existingRanking.id);
            } else {
              await supabase
                .from('institution_rankings')
                .insert({
                  institution_id: existingId,
                  ranking_system: 'uniranks',
                  ranking_year: new Date().getFullYear(),
                  world_rank: record.rank,
                  overall_score: record.score,
                  is_primary: true,
                });
            }
          }

          // Mark staging as completed
          await supabase
            .from('university_import_staging')
            .update({
              status: 'completed',
              matched_university_id: existingId,
              processed_at: new Date().toISOString(),
            })
            .eq('id', record.id);

          continue;
        }

        // ========== NO MATCH → INSERT NEW ==========
        const { data: newUni, error: insertError } = await supabase
          .from('universities')
          .insert({
            name: uniName,
            country_code: extractCountryCode(uniCountry),
            website: record.website_url,
            logo_url: record.logo_url,
            uniranks_slug: uniranksSlug,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`[publish-batch] INSERT FAILED for ${uniName}:`, insertError);
          errors++;
          continue;
        }

        // Add ranking data
        if (newUni && record.rank) {
          await supabase
            .from('institution_rankings')
            .insert({
              institution_id: newUni.id,
              ranking_system: 'uniranks',
              ranking_year: new Date().getFullYear(),
              world_rank: record.rank,
              overall_score: record.score,
              is_primary: true,
            });
        }

        imported++;

        // Mark staging as completed
        await supabase
          .from('university_import_staging')
          .update({
            status: 'completed',
            matched_university_id: newUni?.id,
            processed_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        if (imported % 100 === 0) {
          console.log(`[publish-batch] Progress: ${imported} imported...`);
        }
      } catch (error) {
        console.error(`[publish-batch] Record error:`, error);
        errors++;
      }
    }

    console.log(
      `[publish-batch] ✅ Done — Imported: ${imported}, Duplicates: ${duplicates}, Errors: ${errors}`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        summary: {
          total_staged: totalImported,
          imported,
          duplicates,
          errors,
          existing_in_system: existingCount,
          total_after_import: (existingCount || 0) + imported,
        },
        message: `Imported ${imported} universities. Duplicates merged: ${duplicates}. Errors: ${errors}.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[publish-batch] Error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractCountryCode(countryName: string): string | null {
  const countryMap: Record<string, string> = {
    'United States': 'US', 'United Kingdom': 'GB', 'United Arab Emirates': 'AE',
    'Saudi Arabia': 'SA', 'Egypt': 'EG', 'Philippines': 'PH', 'India': 'IN',
    'Canada': 'CA', 'Australia': 'AU', 'Germany': 'DE', 'France': 'FR',
    'Japan': 'JP', 'China': 'CN', 'South Korea': 'KR', 'Turkey': 'TR',
    'Malaysia': 'MY', 'Singapore': 'SG', 'Netherlands': 'NL', 'Sweden': 'SE',
    'Switzerland': 'CH', 'Italy': 'IT', 'Spain': 'ES', 'Brazil': 'BR',
    'Mexico': 'MX', 'Russia': 'RU', 'South Africa': 'ZA', 'Nigeria': 'NG',
    'Kenya': 'KE', 'Pakistan': 'PK', 'Bangladesh': 'BD', 'Indonesia': 'ID',
    'Thailand': 'TH', 'Vietnam': 'VN', 'Poland': 'PL', 'Czech Republic': 'CZ',
    'Austria': 'AT', 'Belgium': 'BE', 'Denmark': 'DK', 'Finland': 'FI',
    'Norway': 'NO', 'Ireland': 'IE', 'Portugal': 'PT', 'Greece': 'GR',
    'New Zealand': 'NZ', 'Argentina': 'AR', 'Chile': 'CL', 'Colombia': 'CO',
    'Peru': 'PE', 'Taiwan': 'TW', 'Hong Kong': 'HK', 'Israel': 'IL',
    'Jordan': 'JO', 'Lebanon': 'LB', 'Kuwait': 'KW', 'Qatar': 'QA',
    'Bahrain': 'BH', 'Oman': 'OM', 'Iraq': 'IQ', 'Morocco': 'MA',
    'Tunisia': 'TN', 'Algeria': 'DZ', 'Libya': 'LY', 'Sudan': 'SD',
    'Ghana': 'GH', 'Ethiopia': 'ET', 'Tanzania': 'TZ', 'Uganda': 'UG',
    'Ukraine': 'UA', 'Romania': 'RO', 'Hungary': 'HU', 'Croatia': 'HR',
    'Serbia': 'RS', 'Bulgaria': 'BG', 'Slovakia': 'SK', 'Slovenia': 'SI',
    'Lithuania': 'LT', 'Latvia': 'LV', 'Estonia': 'EE', 'Cyprus': 'CY',
    'Malta': 'MT', 'Luxembourg': 'LU', 'Iceland': 'IS',
  };

  return countryMap[countryName] || null;
}
