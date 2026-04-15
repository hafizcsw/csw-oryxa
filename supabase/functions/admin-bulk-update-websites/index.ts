import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UniversityWebsite {
  name_en: string;
  official_website: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { universities, force_overwrite } = await req.json() as { universities: UniversityWebsite[], force_overwrite?: boolean };

    if (!Array.isArray(universities) || universities.length === 0) {
      throw new Error("universities array is required");
    }

    const valid = universities.filter(u => u.name_en && u.official_website && u.name_en !== 'World University Rankings');

    console.log(`[bulk-update-websites] Processing ${valid.length} entries out of ${universities.length} total`);

    let updated = 0;
    let notFound = 0;
    let alreadyHasWebsite = 0;
    let fuzzyMatched = 0;
    const notFoundNames: string[] = [];

    for (const uni of valid) {
      const cleanUrl = uni.official_website
        .replace(/^</, '').replace(/>$/, '')
        .replace(/^https?:\/\//, (m) => m) // keep protocol
        .trim();

      if (!cleanUrl || cleanUrl.length < 5) continue;

      // Strategy 1: Exact match
      let { data: matches } = await supabase
        .from('universities')
        .select('id, name, website')
        .eq('name', uni.name_en)
        .limit(1);

      // Strategy 2: Case-insensitive match
      if (!matches || matches.length === 0) {
        const res = await supabase
          .from('universities')
          .select('id, name, website')
          .ilike('name', uni.name_en)
          .limit(1);
        matches = res.data;
      }

      // Strategy 3: Try with/without "The " prefix
      if (!matches || matches.length === 0) {
        const altName = uni.name_en.startsWith('The ')
          ? uni.name_en.slice(4)
          : `The ${uni.name_en}`;
        const res = await supabase
          .from('universities')
          .select('id, name, website')
          .ilike('name', altName)
          .limit(1);
        matches = res.data;
      }

      // Strategy 4: Fuzzy - contains core name (for minor spelling diffs like ü/u, é/e)
      if (!matches || matches.length === 0) {
        // Normalize: remove special chars, use % wildcards between words
        const words = uni.name_en
          .replace(/[&]/g, 'and')
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 2);
        
        if (words.length >= 2) {
          // Use first 3 significant words for matching
          const searchWords = words.slice(0, Math.min(4, words.length));
          const pattern = `%${searchWords.join('%')}%`;
          const res = await supabase
            .from('universities')
            .select('id, name, website')
            .ilike('name', pattern)
            .limit(3);
          
          if (res.data && res.data.length === 1) {
            // Only use if exactly one match (unambiguous)
            matches = res.data;
            fuzzyMatched++;
          } else if (res.data && res.data.length > 1) {
            // Multiple matches - try to find best one
            const exactIsh = res.data.find(m => 
              m.name.toLowerCase().replace(/[^a-z0-9]/g, '') === 
              uni.name_en.toLowerCase().replace(/[^a-z0-9]/g, '')
            );
            if (exactIsh) {
              matches = [exactIsh];
              fuzzyMatched++;
            }
          }
        }
      }

      if (!matches || matches.length === 0) {
        notFound++;
        notFoundNames.push(uni.name_en);
        continue;
      }

      const match = matches[0];

      // Only update if website is empty (unless force_overwrite)
      if (!force_overwrite && match.website && match.website.trim() !== '') {
        alreadyHasWebsite++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('universities')
        .update({ 
          website: cleanUrl,
          website_source: 'manual_excel',
          website_resolved_at: new Date().toISOString()
        })
        .eq('id', match.id);

      if (updateError) {
        console.error(`Error updating ${uni.name_en}:`, updateError.message);
        continue;
      }

      updated++;
    }

    console.log(`[bulk-update-websites] Done: updated=${updated}, fuzzyMatched=${fuzzyMatched}, notFound=${notFound}, alreadyHasWebsite=${alreadyHasWebsite}`);

    return new Response(
      JSON.stringify({
        ok: true,
        updated,
        fuzzy_matched: fuzzyMatched,
        not_found: notFound,
        already_has_website: alreadyHasWebsite,
        not_found_names: notFoundNames.slice(0, 100),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[bulk-update-websites] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
