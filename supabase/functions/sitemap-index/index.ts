import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const host = req.headers.get('host') || 'example.com';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    
    const kinds = ['countries', 'universities', 'programs', 'scholarships'];
    const sitemaps: string[] = [];

    for (const kind of kinds) {
      const { data, error } = await supabase.rpc('sitemap_lastmod', { _kind: kind });
      
      if (error) {
        console.error(`Error fetching ${kind} lastmod:`, error);
        continue;
      }

      const lastmod = data?.[0]?.lastmod || new Date().toISOString();
      const count = data?.[0]?.count || 0;

      if (count === 0) continue;

      const filesNeeded = Math.ceil(count / 50000);

      for (let i = 0; i < filesNeeded; i++) {
        const fileIndex = filesNeeded > 1 ? `-${i + 1}` : '';
        sitemaps.push(`
    <sitemap>
      <loc>${baseUrl}/sitemap/${kind}${fileIndex}.xml</loc>
      <lastmod>${new Date(lastmod).toISOString().split('T')[0]}</lastmod>
    </sitemap>`);
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.join('')}
</sitemapindex>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Sitemap index error:', error);
    return new Response('Internal Server Error', { 
      status: 500,
      headers: corsHeaders,
    });
  }
});
