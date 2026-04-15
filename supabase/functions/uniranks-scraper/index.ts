import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface UniRankUniversity {
  name: string;
  slug: string;
  country: string;
  rank: number;
  score: number | null;
  logo_url: string | null;
  is_verified: boolean;
  tier: string | null; // Elite, Top World, etc.
}

/**
 * Parse universities from the markdown content
 * Format: 
 * [![Name Ranking 2026](logo_url)](detail_url)
 * [**Name**](detail_url)
 * Rank X | Score Y | Location Country | Recognized, Verified
 */
function parseUniversitiesFromMarkdown(markdown: string): UniRankUniversity[] {
  const universities: UniRankUniversity[] = [];
  const lines = markdown.split('\n');
  
  let currentUni: Partial<UniRankUniversity> | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Match logo pattern: [![Name Ranking 2026](logo_url)](detail_url)
    const logoMatch = line.match(/\[!\[([^\]]+)\s+Ranking\s+\d+\]\(([^)]+)\)\]\(https:\/\/www\.uniranks\.com\/universities\/([^)]+)\)/);
    if (logoMatch) {
      // Save previous university if exists
      if (currentUni && currentUni.name && currentUni.country && currentUni.rank) {
        universities.push(currentUni as UniRankUniversity);
      }
      
      currentUni = {
        name: logoMatch[1].replace(' Ranking', '').trim(),
        slug: logoMatch[3],
        logo_url: logoMatch[2],
        is_verified: false,
        tier: null,
      };
      continue;
    }
    
    // Match name pattern: [**Name**](detail_url)
    const nameMatch = line.match(/\[\*\*([^\*]+)\*\*\]\(https:\/\/www\.uniranks\.com\/universities\/([^)]+)\)/);
    if (nameMatch && !currentUni) {
      currentUni = {
        name: nameMatch[1],
        slug: nameMatch[2],
        is_verified: false,
        tier: null,
      };
      continue;
    }
    
    // Match rank/score/location pattern: Rank X | Score Y | Location Country | Recognized, Verified
    const infoMatch = line.match(/Rank\s+(\d+)\s*\|?\s*Score\s*([\d.]+)\s*\|?\s*Location\s+([^|]+?)\s*\|?\s*(.*)/i);
    if (infoMatch && currentUni) {
      currentUni.rank = parseInt(infoMatch[1], 10);
      currentUni.score = parseFloat(infoMatch[2]);
      currentUni.country = infoMatch[3].trim();
      currentUni.is_verified = /verified/i.test(infoMatch[4]);
      continue;
    }
    
    // Alternative pattern: Rank 1 \| Score 94.74 \| Location United States of America \| Recognized, Verified
    const altInfoMatch = line.match(/Rank\s+(\d+)\s*\\?\|?\s*Score\s*([\d.]+)\s*\\?\|?\s*Location\s+([^\|\\]+)/i);
    if (altInfoMatch && currentUni) {
      currentUni.rank = parseInt(altInfoMatch[1], 10);
      currentUni.score = parseFloat(altInfoMatch[2]);
      currentUni.country = altInfoMatch[3].trim();
      currentUni.is_verified = /verified/i.test(line);
      continue;
    }
    
    // Detect tier from award images
    if (/Elite|Platinum/i.test(line) && currentUni) {
      currentUni.tier = 'Elite';
    } else if (/Top World/i.test(line) && currentUni) {
      currentUni.tier = 'Top World';
    }
  }
  
  // Don't forget the last one
  if (currentUni && currentUni.name && currentUni.country && currentUni.rank) {
    universities.push(currentUni as UniRankUniversity);
  }
  
  // Remove duplicates (same slug)
  const seen = new Set<string>();
  return universities.filter(uni => {
    if (seen.has(uni.slug)) return false;
    seen.add(uni.slug);
    return true;
  });
}

/**
 * Fetch a page with proper headers
 */
async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: controller.signal,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Convert HTML to basic markdown for parsing
 */
function htmlToBasicMarkdown(html: string): string {
  // Extract university cards - they follow a specific pattern
  let markdown = '';
  
  // Find all university links and images
  const uniPattern = /<a[^>]*href="(https:\/\/www\.uniranks\.com\/universities\/[^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi;
  const rankPattern = /<span[^>]*class="[^"]*rank[^"]*"[^>]*>(\d+)<\/span>/gi;
  const scorePattern = /<span[^>]*class="[^"]*score[^"]*"[^>]*>([\d.]+)<\/span>/gi;
  const countryPattern = /<span[^>]*class="[^"]*country[^"]*"[^>]*>([^<]+)<\/span>/gi;
  
  // Alternative: Parse JSON-LD if available
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      if (data.itemListElement) {
        for (const item of data.itemListElement) {
          const uni = item.item || item;
          markdown += `[![${uni.name} Ranking 2026](${uni.logo || ''})](${uni.url})\n`;
          markdown += `[**${uni.name}**](${uni.url})\n`;
          markdown += `Rank ${item.position || 0} | Score ${uni.score || 0} | Location ${uni.address?.addressCountry || 'Unknown'} | Verified\n\n`;
        }
        return markdown;
      }
    } catch (e) {
      console.log('JSON-LD parsing failed');
    }
  }
  
  // Fall back to regex parsing
  // This site loads data dynamically, so we need a simpler approach
  // Let's extract what we can from the HTML structure
  
  // Look for university cards in the Livewire data
  const livewireMatch = html.match(/wire:initial-data="([^"]+)"/);
  if (livewireMatch) {
    try {
      const decoded = livewireMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      const data = JSON.parse(decoded);
      console.log('Found Livewire data');
      // Process livewire data...
    } catch (e) {
      console.log('Livewire parsing failed');
    }
  }
  
  return markdown;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      action = 'fetch', 
      category = 'verified-universities',
      country = null,
      page = 1,
      markdown_content = null,
    } = body;
    
    console.log(`[uniranks-scraper] Action: ${action}, Category: ${category}, Country: ${country}, Page: ${page}`);
    
    // If markdown content is provided directly (from frontend), parse it
    if (action === 'parse' && markdown_content) {
      const universities = parseUniversitiesFromMarkdown(markdown_content);
      console.log(`[uniranks-scraper] Parsed ${universities.length} universities from provided markdown`);
      
      return new Response(
        JSON.stringify({
          ok: true,
          count: universities.length,
          universities,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (action === 'fetch') {
      // Build URL
      let url = `https://www.uniranks.com/ranking/${category}`;
      if (country) {
        url = `https://www.uniranks.com/ranking/${country}`;
      }
      
      console.log(`[uniranks-scraper] Fetching: ${url}`);
      
      const html = await fetchPage(url);
      console.log(`[uniranks-scraper] Fetched ${html.length} bytes`);
      
      // Try to convert and parse
      const markdown = htmlToBasicMarkdown(html);
      const universities = parseUniversitiesFromMarkdown(markdown);
      
      // If dynamic loading, return instructions
      if (universities.length === 0) {
        return new Response(
          JSON.stringify({
            ok: true,
            count: 0,
            universities: [],
            message: "Site uses dynamic loading. Use 'parse' action with pre-fetched markdown content.",
            hint: "Fetch the page with a tool that renders JavaScript, then pass the markdown to this endpoint.",
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({
          ok: true,
          count: universities.length,
          universities,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (action === 'import') {
      // Import parsed universities to staging table
      const { universities } = body;
      
      if (!universities || !Array.isArray(universities) || universities.length === 0) {
        throw new Error("universities array is required for import action");
      }
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Map to staging format
      const stagingData = universities.map((uni: UniRankUniversity) => ({
        source: 'uniranks',
        external_id: `uniranks_${uni.slug}`,
        name: uni.name,
        country_name: uni.country,
        rank: uni.rank,
        score: uni.score,
        website_url: `https://www.uniranks.com/universities/${uni.slug}`,
        logo_url: uni.logo_url,
        is_verified: uni.is_verified,
        tier: uni.tier,
        raw_data: uni,
        imported_at: new Date().toISOString(),
      }));
      
      // Upsert to staging
      const { data, error } = await supabase
        .from('university_import_staging')
        .upsert(stagingData, { onConflict: 'source,external_id' })
        .select('id');
      
      if (error) {
        console.error('[uniranks-scraper] Import error:', error);
        throw error;
      }
      
      return new Response(
        JSON.stringify({
          ok: true,
          imported: data?.length || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (action === 'list-countries') {
      // Return list of available country slugs
      const countries = [
        { slug: 'united-states-of-america', name: 'United States of America' },
        { slug: 'united-kingdom', name: 'United Kingdom' },
        { slug: 'canada', name: 'Canada' },
        { slug: 'australia', name: 'Australia' },
        { slug: 'germany', name: 'Germany' },
        { slug: 'france', name: 'France' },
        { slug: 'japan', name: 'Japan' },
        { slug: 'china', name: 'China' },
        { slug: 'india', name: 'India' },
        { slug: 'saudi-arabia', name: 'Saudi Arabia' },
        { slug: 'united-arab-emirates', name: 'United Arab Emirates' },
        { slug: 'egypt', name: 'Egypt' },
        { slug: 'turkey', name: 'Turkey' },
        { slug: 'russia', name: 'Russia' },
        { slug: 'brazil', name: 'Brazil' },
        { slug: 'mexico', name: 'Mexico' },
        { slug: 'south-korea', name: 'South Korea' },
        { slug: 'netherlands', name: 'Netherlands' },
        { slug: 'italy', name: 'Italy' },
        { slug: 'spain', name: 'Spain' },
      ];
      
      return new Response(
        JSON.stringify({ ok: true, countries }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    throw new Error(`Unknown action: ${action}`);
    
  } catch (error: any) {
    console.error('[uniranks-scraper] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
